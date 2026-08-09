using MySqlConnector;
using YEPPDash.Api.Bot;
using YEPPDash.Api.Data.Module;
using YEPPDash.Api.Exceptions.Module;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class ModuleService(
    ModuleRepository repository, YeppBotClient bot, ILogger<ModuleService> logger)
{
    /// <summary>
    /// The whole catalogue, each module carrying whether this channel has it on. Modules are
    /// hard-coded, so the list never shrinks for a channel that has blocked nothing.
    /// </summary>
    public async Task<IReadOnlyList<BotModuleState>> GetAsync(string channelId, CancellationToken cancellationToken)
    {
        var blocked = await repository.GetBlockedAsync(ParseChannelId(channelId), cancellationToken);
        var set = blocked.ToHashSet(StringComparer.Ordinal);

        return BotModuleCatalog.All
            .Select(module => new BotModuleState(module, Enabled: !set.Contains(module.Id)))
            .ToList();
    }

    /// <returns><c>null</c> when no module goes by that id.</returns>
    public async Task<BotModuleState?> SetEnabledAsync(
        string channelId, string moduleId, bool enabled, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);

        // An id the catalogue does not know is a 404 rather than a row: the bot only ever blocks
        // commands it actually registers, so a free-text write here would block nothing while
        // looking like it worked.
        if (BotModuleCatalog.Find(moduleId) is not { } module) return null;

        var changed = await Guard(id, () => enabled
            ? repository.UnblockAsync(id, module.Id, cancellationToken)
            : repository.BlockAsync(id, module.Id, cancellationToken));

        if (changed)
        {
            logger.LogInformation(
                "Turned module '{Module}' of channel {ChannelId} {State}", module.Id, id, enabled ? "on" : "off");

            await ReloadBotAsync(module.Id, id, cancellationToken);
        }

        return new BotModuleState(module, enabled);
    }

    /// <summary>
    /// The bot keeps one blacklist for every channel it serves and reloads all of it at once, so
    /// this is not scoped to the channel that changed.
    /// </summary>
    private async Task ReloadBotAsync(string moduleId, int channelId, CancellationToken cancellationToken)
    {
        if (!bot.Configured) return;

        var result = await bot.UpdateBlacklistAsync(cancellationToken);

        if (result.Success)
        {
            logger.LogInformation(
                "Asked YEPPBot to reload its blacklist after '{Module}' changed for channel {ChannelId}",
                moduleId, channelId);

            return;
        }

        // Best effort, exactly like the command reloads: the row is already committed, so a bot that
        // cannot be reached only keeps answering the old way until it is asked again or restarts.
        logger.LogWarning(
            "YEPPBot did not reload its blacklist after '{Module}' changed for channel {ChannelId}: {Message}",
            moduleId, channelId, result.Message);
    }

    private static async Task<T> Guard<T>(int channelId, Func<Task<T>> write)
    {
        try
        {
            return await write();
        }
        // Blacklist's foreign key points at Channel, not User — a channel the bot has never joined
        // has no row to hang a blocked module off.
        catch (MySqlException exception)
            when (exception.ErrorCode is MySqlErrorCode.NoReferencedRow or MySqlErrorCode.NoReferencedRow2)
        {
            throw new UnknownModuleChannelException(channelId, exception);
        }
    }

    private static int ParseChannelId(string channelId)
    {
        if (!int.TryParse(channelId, out var id))
        {
            throw new ArgumentException($"'{channelId}' is not a numeric Twitch user ID.", nameof(channelId));
        }

        return id;
    }
}
