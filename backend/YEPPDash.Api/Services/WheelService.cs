using YEPPDash.Api.Data.Wheel;
using YEPPDash.Api.Exceptions.Wheel;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Services;

public sealed class WheelService(WheelRepository repository, WheelHub hub, ILogger<WheelService> logger)
{
    public Task<int> CountAsync(string broadcasterId, CancellationToken cancellationToken)
        => repository.CountAsync(ParseChannelId(broadcasterId), cancellationToken);

    public async Task<IReadOnlyList<WheelSummary>> ListAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var channelId = ParseChannelId(broadcasterId);

        var configs = await repository.GetChannelAsync(channelId, cancellationToken);
        if (configs.Count is 0) return [];

        var counts = await repository.CountsAsync(channelId, cancellationToken);

        return
        [
            .. configs.Select(config =>
            {
                counts.TryGetValue(config.Id, out var count);

                return new WheelSummary(config.Id, config.Name, count.Entries, count.Slices, config.UpdatedAt);
            }),
        ];
    }

    public async Task<WheelResponse?> GetAsync(string broadcasterId, Guid wheelId, CancellationToken cancellationToken)
    {
        var config = await repository.GetAsync(ParseChannelId(broadcasterId), wheelId, cancellationToken);
        if (config is null) return null;

        return Describe(config, await repository.EntriesAsync(wheelId, cancellationToken));
    }

    public async Task<WheelResponse> CreateAsync(
        string broadcasterId, WheelUpdate update, CancellationToken cancellationToken)
    {
        var channelId = ParseChannelId(broadcasterId);

        var config = new WheelConfig(Guid.NewGuid(), channelId, Name(update.Name), DateTime.UtcNow);
        var entries = Normalize(update.Entries);

        await repository.InsertAsync(config, entries, cancellationToken);
        logger.LogInformation("Channel {ChannelId} created the wheel {WheelId}", channelId, config.Id);

        return Describe(config, entries);
    }

    public async Task<WheelResponse?> SaveAsync(
        string broadcasterId, Guid wheelId, WheelUpdate update, CancellationToken cancellationToken)
    {
        var channelId = ParseChannelId(broadcasterId);

        var stored = await repository.GetAsync(channelId, wheelId, cancellationToken);
        if (stored is null) return null;

        var config = stored with { Name = Name(update.Name), UpdatedAt = DateTime.UtcNow };
        var entries = Normalize(update.Entries);

        if (!await repository.UpdateAsync(config, entries, cancellationToken)) return null;

        logger.LogDebug("Stored {Count} entries on the wheel {WheelId}", entries.Count, config.Id);

        hub.Publish(channelId, WheelEvents.OverlayState(config.Id, Overlay(config, entries)), StreamAudience.Overlay);

        return Describe(config, entries);
    }

    public async Task<bool> DeleteAsync(string broadcasterId, Guid wheelId, CancellationToken cancellationToken)
    {
        var channelId = ParseChannelId(broadcasterId);

        if (!await repository.DeleteAsync(channelId, wheelId, cancellationToken)) return false;

        logger.LogInformation("Channel {ChannelId} deleted the wheel {WheelId}", channelId, wheelId);

        hub.Publish(channelId, WheelEvents.OverlayState(wheelId, null), StreamAudience.Overlay);

        return true;
    }

    public void Spin(string broadcasterId, Guid wheelId, int index)
    {
        hub.Publish(ParseChannelId(broadcasterId), WheelEvents.OverlaySpin(wheelId, index), StreamAudience.Overlay);
    }

    public void Dismiss(string broadcasterId, Guid wheelId)
    {
        hub.Publish(ParseChannelId(broadcasterId), WheelEvents.OverlayDismiss(wheelId), StreamAudience.Overlay);
    }

    public async Task<WheelOverlayState?> OverlayAsync(Guid wheelId, CancellationToken cancellationToken)
    {
        var config = await repository.FindAsync(wheelId, cancellationToken);
        if (config is null) return null;

        return Overlay(config, await repository.EntriesAsync(wheelId, cancellationToken));
    }

    public async Task<int?> ChannelOfAsync(Guid wheelId, CancellationToken cancellationToken)
        => (await repository.FindAsync(wheelId, cancellationToken))?.ChannelId;

    private static WheelResponse Describe(WheelConfig config, IReadOnlyList<WheelEntry> entries)
    {
        return new WheelResponse(config.Id, config.Name, entries, config.UpdatedAt);
    }

    private static WheelOverlayState Overlay(WheelConfig config, IReadOnlyList<WheelEntry> entries)
    {
        return new WheelOverlayState(config.Id, config.Name, entries);
    }

    private static string Name(string? name)
    {
        var trimmed = (name ?? string.Empty).Trim();

        if (trimmed.Length is 0)
        {
            throw new InvalidWheelException("A wheel needs a name.");
        }

        if (trimmed.Length > WheelLimits.MaxNameLength)
        {
            throw new InvalidWheelException($"A name cannot be longer than {WheelLimits.MaxNameLength} characters.");
        }

        return trimmed;
    }

    private static IReadOnlyList<WheelEntry> Normalize(IReadOnlyList<WheelEntryUpdate> entries)
    {
        return WheelEntry.Merge(entries.Select(entry => new WheelEntry(entry.Label ?? string.Empty, entry.Count)));
    }

    private static int ParseChannelId(string channelId)
    {
        return !int.TryParse(channelId, out var id) ? throw new ArgumentException($"'{channelId}' is not a numeric Twitch user ID.", nameof(channelId)) : id;
    }
}