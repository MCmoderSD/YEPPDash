using YEPPDash.Api.Data.Wheel;
using YEPPDash.Api.Exceptions.Wheel;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class WheelService(WheelRepository repository, ILogger<WheelService> logger)
{
    public async Task<IReadOnlyList<string>> GetAsync(string channelId, CancellationToken cancellationToken)
    {
        return await repository.GetAsync(ParseChannelId(channelId), cancellationToken) ?? [];
    }

    public async Task<IReadOnlyList<string>> SaveAsync(
        string channelId, WheelRequest request, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);
        var entries = Normalize(request.Entries);

        await repository.SaveAsync(id, entries, cancellationToken);
        logger.LogDebug("Stored {Count} entries for the channel {ChannelId}", entries.Count, id);

        return entries;
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
        return !int.TryParse(channelId, out var id) ? throw new ArgumentException($"'{channelId}' is not a numeric Twitch user ID.", nameof(channelId)) : id;
    }
}