using YEPPDash.Api.Data.Wheel;
using YEPPDash.Api.Exceptions.Wheel;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class WheelService(WheelRepository repository, ILogger<WheelService> logger)
{
    // A channel with nothing stored is not an error — it is a wheel nobody has filled in yet, and
    // the overlay asks for it before the streamer has ever opened the page.
    public async Task<Data.Wheel.Wheel> GetAsync(string channelId, CancellationToken cancellationToken)
    {
        var stored = await repository.GetAsync(ParseChannelId(channelId), cancellationToken);

        return stored ?? new Data.Wheel.Wheel([], WheelType.Wheel);
    }

    public async Task<Data.Wheel.Wheel> SaveAsync(
        string channelId, WheelRequest request, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);
        var entries = Normalize(request.Entries);

        await repository.SaveAsync(id, entries, request.Type, cancellationToken);
        logger.LogDebug("Stored {Count} {Type} entries for channel {ChannelId}", entries.Count, request.Type, id);

        return new Data.Wheel.Wheel(entries, request.Type);
    }

    public Task<bool> DeleteAsync(string channelId, CancellationToken cancellationToken)
    {
        return repository.DeleteAsync(ParseChannelId(channelId), cancellationToken);
    }

    // Entries live in one column joined by commas, so a comma inside one would come back as two
    // entries. It is rejected rather than quietly stripped: the name that comes back out has to be
    // the name that went in.
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

            // Skipped rather than rejected: a blank line is what an imported file ends with.
            if (trimmed.Length is 0) continue;

            if (trimmed.Contains(WheelLimits.Separator))
            {
                throw new InvalidWheelException(
                    $"An entry cannot contain a '{WheelLimits.Separator}' — that is what separates them.");
            }

            if (trimmed.Length > WheelLimits.MaxEntryLength)
            {
                throw new InvalidWheelException(
                    $"An entry cannot be longer than {WheelLimits.MaxEntryLength} characters.");
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
