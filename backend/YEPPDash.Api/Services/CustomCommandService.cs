using System.Text.RegularExpressions;
using MySqlConnector;
using YEPPDash.Api.Bot;
using YEPPDash.Api.Data;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

/// <summary>Thrown when a command cannot be stored as written.</summary>
public sealed class InvalidCustomCommandException(string reason) : Exception(reason);

/// <summary>
/// Thrown when a trigger is already taken by another command in the same channel.
/// </summary>
public sealed class DuplicateCustomCommandException(string trigger)
    : Exception($"'{trigger}' is already used by another command in this channel.")
{
    public string Trigger { get; } = trigger;
}

/// <summary>
/// Thrown when the channel has no row in YEPPBot's User table, so a command cannot reference it.
/// </summary>
public sealed class UnknownCustomCommandChannelException(int channelId, Exception inner)
    : Exception($"Channel {channelId} is not known to YEPPBot.", inner);

public sealed partial class CustomCommandService(
    CustomCommandRepository repository, YeppBotClient bot, ILogger<CustomCommandService> logger)
{
    public Task<IReadOnlyList<CustomCommand>> GetAsync(string channelId, CancellationToken cancellationToken)
    {
        return repository.GetAllAsync(ParseChannelId(channelId), cancellationToken);
    }

    public async Task<CustomCommand> AddAsync(
        string channelId, CustomCommandRequest request, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);
        var command = Normalize(request);

        await EnsureTriggersAreFreeAsync(id, command, replacing: null, cancellationToken);

        // The name is the table's own key, so the insert refusing it is the authoritative answer —
        // the check above only catches what the key cannot see, which is the alias list.
        if (!await Guard(id, command.Name, () => repository.AddAsync(id, command, cancellationToken)))
        {
            throw new DuplicateCustomCommandException(command.Name);
        }

        logger.LogInformation("Added command '{Name}' to channel {ChannelId}", command.Name, id);

        await ReloadBotAsync(id, cancellationToken);
        return command;
    }

    /// <param name="name">The command to rewrite. The request may give it a different one.</param>
    /// <returns>The stored command, or <c>null</c> when the channel has no command under that name.</returns>
    public async Task<CustomCommand?> UpdateAsync(
        string channelId, string name, CustomCommandRequest request, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);
        var stored = Lower(name);
        var command = Normalize(request);

        // Checked before the write so a rename onto a taken trigger is refused rather than half
        // applied, and against everything except the command being edited — it may keep its own.
        await EnsureTriggersAreFreeAsync(id, command, replacing: stored, cancellationToken);

        var updated = await Guard(id, command.Name, () => repository.UpdateAsync(id, stored, command, cancellationToken));

        if (updated is not null)
        {
            logger.LogInformation("Updated command '{Name}' of channel {ChannelId}", stored, id);
            await ReloadBotAsync(id, cancellationToken);
        }

        return updated;
    }

    /// <returns>The stored command, or <c>null</c> when the channel has no command under that name.</returns>
    public async Task<CustomCommand?> SetActiveAsync(
        string channelId, string name, bool active, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);

        // Nothing but the one column changes, so this cannot collide with another command's
        // triggers and does not go through the check above.
        var updated = await repository.SetActiveAsync(id, Lower(name), active, cancellationToken);

        if (updated is not null)
        {
            logger.LogInformation(
                "Turned command '{Name}' of channel {ChannelId} {State}", updated.Name, id, active ? "on" : "off");

            await ReloadBotAsync(id, cancellationToken);
        }

        return updated;
    }

    public async Task<bool> DeleteAsync(string channelId, string name, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);
        var deleted = await repository.DeleteAsync(id, Lower(name), cancellationToken);

        if (deleted)
        {
            logger.LogInformation("Deleted command '{Name}' of channel {ChannelId}", Lower(name), id);
            await ReloadBotAsync(id, cancellationToken);
        }

        return deleted;
    }

    /// <summary>
    /// Tells the bot to re-read the channel's commands, after they have already been written.
    /// </summary>
    /// <remarks>
    /// Best effort by design. The write it follows has committed, so a bot that is down, not
    /// configured, or refusing us is not a reason to report the edit as failed — it only means the
    /// bot answers with the old command until it is restarted or asked again. That is worth a log
    /// line, not an error the channel has to act on.
    /// </remarks>
    private async Task ReloadBotAsync(int channelId, CancellationToken cancellationToken)
    {
        if (!bot.Configured) return;

        var result = await bot.UpdateCustomCommandsAsync(
            channelId.ToString(), cancellationToken);

        if (result.Success)
        {
            logger.LogInformation("Asked YEPPBot to reload the commands of channel {ChannelId}", channelId);
            return;
        }

        logger.LogWarning(
            "YEPPBot did not reload the commands of channel {ChannelId}: {Message}", channelId, result.Message);
    }

    /// <summary>
    /// Runs a write, turning the two database failures the caller can do something about into
    /// exceptions that say what happened.
    /// </summary>
    /// <exception cref="UnknownCustomCommandChannelException">The channel is not in YEPPBot's User table.</exception>
    /// <exception cref="DuplicateCustomCommandException">A rename landed on a name already in use.</exception>
    private static async Task<T> Guard<T>(int channelId, string name, Func<Task<T>> write)
    {
        try
        {
            return await write();
        }
        catch (MySqlException exception)
            when (exception.ErrorCode is MySqlErrorCode.NoReferencedRow or MySqlErrorCode.NoReferencedRow2)
        {
            throw new UnknownCustomCommandChannelException(channelId, exception);
        }
        // Only a rename can land here — an insert reports a taken name by answering false instead.
        catch (MySqlException exception) when (exception.ErrorCode is MySqlErrorCode.DuplicateKeyEntry)
        {
            throw new DuplicateCustomCommandException(name);
        }
    }

    /// <exception cref="DuplicateCustomCommandException">One of the triggers is already taken.</exception>
    private async Task EnsureTriggersAreFreeAsync(
        int channelId, CustomCommand command, string? replacing, CancellationToken cancellationToken)
    {
        var existing = await repository.GetAllAsync(channelId, cancellationToken);

        var taken = existing
            .Where(other => replacing is null || !string.Equals(other.Name, replacing, StringComparison.Ordinal))
            .SelectMany(other => other.Triggers)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var trigger in command.Triggers)
        {
            if (taken.Contains(trigger)) throw new DuplicateCustomCommandException(trigger);
        }
    }

    /// <summary>
    /// Trims the command into the shape it is stored in: lower case, no <c>!</c> prefix, no blank or
    /// repeated aliases, and no alias that only repeats the name.
    /// </summary>
    /// <exception cref="InvalidCustomCommandException">The command is not usable as written.</exception>
    private static CustomCommand Normalize(CustomCommandRequest request)
    {
        var name = Trigger(request.Name, "name");
        var message = request.Message.Trim();

        if (message.Length is 0) throw new InvalidCustomCommandException("A command needs a message.");

        if (message.Length > CustomCommandLimits.MaxLength)
        {
            throw new InvalidCustomCommandException(
                $"A message cannot be longer than {CustomCommandLimits.MaxLength} characters.");
        }

        // Ordered set: duplicates and the name itself drop out, but what is left keeps the order it
        // was entered in, so the list does not reshuffle every time it is read back.
        var seen = new HashSet<string>(StringComparer.Ordinal) { name };
        var aliases = new List<string>();

        foreach (var alias in request.Aliases)
        {
            // A blank row in the alias editor means "I did not fill this one in", not an error.
            if (string.IsNullOrWhiteSpace(alias)) continue;

            var trigger = Trigger(alias, "alias");
            if (seen.Add(trigger)) aliases.Add(trigger);
        }

        // The aliases share one column, so the ceiling is on the joined list rather than on any one
        // of them — which is only knowable once they are all in.
        if (CustomCommandRepository.JoinAliases(aliases).Length > CustomCommandLimits.MaxLength)
        {
            throw new InvalidCustomCommandException(
                $"The aliases together cannot be longer than {CustomCommandLimits.MaxLength} characters.");
        }

        return new CustomCommand(name, aliases, message, request.Active, request.ResponseType, request.UserLevel);
    }

    /// <summary>Cleans one trigger word into the exact bytes the table is keyed on.</summary>
    private static string Trigger(string value, string kind)
    {
        // The prefix chat types is not part of the name, and the table collates binary — so the case
        // it is stored in is the case it has to be looked up in.
        var trimmed = Lower(value.Trim().TrimStart('!').Trim());

        if (trimmed.Length is 0) throw new InvalidCustomCommandException($"A command needs a {kind}.");

        if (trimmed.Length > CustomCommandLimits.MaxLength)
        {
            throw new InvalidCustomCommandException(
                $"A {kind} cannot be longer than {CustomCommandLimits.MaxLength} characters.");
        }

        // Letters and digits only. A space would stop it firing at all (chat splits on those before
        // it looks a command up) and a comma would split it into two, since the aliases share one
        // comma-separated column.
        if (!TriggerPattern().IsMatch(trimmed))
        {
            throw new InvalidCustomCommandException($"A {kind} can only contain letters and numbers.");
        }

        return trimmed;
    }

    private static string Lower(string value)
    {
        return value.ToLowerInvariant();
    }

    private static int ParseChannelId(string channelId)
    {
        if (!int.TryParse(channelId, out var id))
        {
            throw new ArgumentException($"'{channelId}' is not a numeric Twitch user ID.", nameof(channelId));
        }

        return id;
    }

    // Any script's letters and digits, not just ASCII — a channel writing its commands in Cyrillic
    // or Kana is not doing anything the bot cannot match on.
    [GeneratedRegex(@"^[\p{L}\p{N}]+$")]
    private static partial Regex TriggerPattern();
}
