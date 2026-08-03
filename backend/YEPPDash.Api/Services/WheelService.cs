using YEPPDash.Api.Data.Wheel;
using YEPPDash.Api.Exceptions.Wheel;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class WheelService(WheelRepository repository, ILogger<WheelService> logger)
{
    public async Task<Wheel> GetAsync(string channelId, CancellationToken cancellationToken)
    {
        var stored = await repository.GetAsync(ParseChannelId(channelId), cancellationToken);

        return stored ?? new Wheel([]);
    }

    public async Task<Wheel> SaveAsync(string channelId, WheelRequest request, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);
        var entries = Normalize(request.Entries);

        await repository.SaveAsync(id, entries, cancellationToken);
        logger.LogDebug("Stored {Count} entries for channel {ChannelId}", entries.Count, id);

        return new Wheel(entries);
    }

    public Task<bool> DeleteAsync(string channelId, CancellationToken cancellationToken)
    {
        return repository.DeleteAsync(ParseChannelId(channelId), cancellationToken);
    }

    private static IReadOnlyList<string> Normalize(IReadOnlyList<string> entries)
    {
        if (entries.Count > WheelLimits.MaxEntries)
        {
            throw new InvalidWheelException($"A wheel cannot hold more than {WheelLimits.MaxEntries} entries.");
        }

        var normalized = new List<string>(entries.Count);

        foreach (var entry in entries)
        {
            var trimmed = entry.Trim();

            if (trimmed.Length is 0) continue;

            if (trimmed.Contains(WheelLimits.Separator))
            {
                throw new InvalidWheelException($"An entry cannot contain a '{WheelLimits.Separator}' — that is what separates them.");
            }

            if (trimmed.Length > WheelLimits.MaxEntryLength)
            {
                throw new InvalidWheelException($"An entry cannot be longer than {WheelLimits.MaxEntryLength} characters.");
            }

            normalized.Add(trimmed);
        }

        return normalized;
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