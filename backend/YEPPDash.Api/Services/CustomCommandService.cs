using System.Text.RegularExpressions;
using MySqlConnector;
using YEPPDash.Api.Bot;
using YEPPDash.Api.Data.CustomCommand;
using YEPPDash.Api.Exceptions.CustomCommand;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

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

        if (!await Guard(id, command.Name, () => repository.AddAsync(id, command, cancellationToken)))
        {
            throw new DuplicateCustomCommandException(command.Name);
        }

        logger.LogInformation("Added command '{Name}' to channel {ChannelId}", command.Name, id);

        await ReloadBotAsync(id, cancellationToken);
        return command;
    }

    public async Task<CustomCommand?> UpdateAsync(string channelId, string name, CustomCommandRequest request, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);
        var stored = Lower(name);
        var command = Normalize(request);

        await EnsureTriggersAreFreeAsync(id, command, replacing: stored, cancellationToken);

        var updated = await Guard(id, command.Name, () => repository.UpdateAsync(id, stored, command, cancellationToken));

        if (updated is not null)
        {
            logger.LogInformation("Updated command '{Name}' of channel {ChannelId}", stored, id);
            await ReloadBotAsync(id, cancellationToken);
        }

        return updated;
    }

    public async Task<CustomCommand?> SetActiveAsync(string channelId, string name, bool active, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);

        var updated = await repository.SetActiveAsync(id, Lower(name), active, cancellationToken);

        if (updated is not null)
        {
            logger.LogInformation("Turned command '{Name}' of channel {ChannelId} {State}", updated.Name, id, active ? "on" : "off");

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

    private async Task ReloadBotAsync(int channelId, CancellationToken cancellationToken)
    {
        if (!bot.Configured) return;

        var result = await bot.UpdateCustomCommandsAsync(
            channelId.ToString(), cancellationToken);

        if (result.Success)
        {
            logger.LogInformation("Asked YEPPBot to reload the commands of the channel {ChannelId}", channelId);
            return;
        }

        logger.LogWarning("YEPPBot did not reload the commands of channel {ChannelId}: {Message}", channelId, result.Message);
    }

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

    private async Task EnsureTriggersAreFreeAsync(int channelId, CustomCommand command, string? replacing, CancellationToken cancellationToken)
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

    private static CustomCommand Normalize(CustomCommandRequest request)
    {
        var name = Trigger(request.Name, "name");
        var message = request.Message.Trim();

        if (message.Length is 0) throw new InvalidCustomCommandException("A command needs a message.");

        if (message.Length > CustomCommandLimits.MaxLength)
        {
            throw new InvalidCustomCommandException($"A message cannot be longer than {CustomCommandLimits.MaxLength} characters.");
        }

        var seen = new HashSet<string>(StringComparer.Ordinal) { name };
        var aliases = new List<string>();

        foreach (var alias in request.Aliases)
        {
            if (string.IsNullOrWhiteSpace(alias)) continue;

            var trigger = Trigger(alias, "alias");
            if (seen.Add(trigger)) aliases.Add(trigger);
        }

        if (CustomCommandRepository.JoinAliases(aliases).Length > CustomCommandLimits.MaxLength)
        {
            throw new InvalidCustomCommandException($"The aliases together cannot be longer than {CustomCommandLimits.MaxLength} characters.");
        }

        return new CustomCommand(name, aliases, message, request.Active, request.ResponseType, request.UserLevel);
    }

    private static string Trigger(string value, string kind)
    {

        var trimmed = Lower(value.Trim().TrimStart('!').Trim());

        if (trimmed.Length is 0) throw new InvalidCustomCommandException($"A command needs a {kind}.");

        if (trimmed.Length > CustomCommandLimits.MaxLength)
        {
            throw new InvalidCustomCommandException(
                $"A {kind} cannot be longer than {CustomCommandLimits.MaxLength} characters.");
        }

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

    [GeneratedRegex(@"^[\p{L}\p{N}]+$")]
    private static partial Regex TriggerPattern();
}