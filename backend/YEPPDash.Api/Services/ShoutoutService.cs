using YEPPDash.Api.Data.Shoutout;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

// The bot picks Channel up on its own schedule and its API has no reload for these settings the way
// it has for custom commands, so a toggle is the database write and nothing more.
public sealed class ShoutoutService(ShoutoutRepository repository, ILogger<ShoutoutService> logger)
{
    public Task<ShoutoutSettings?> GetAsync(string channelId, CancellationToken cancellationToken)
    {
        return repository.GetAsync(ParseChannelId(channelId), cancellationToken);
    }

    public async Task<ShoutoutSettings?> SetAutoShoutoutAsync(string channelId, bool autoShoutout, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);
        var settings = await repository.SetAutoShoutoutAsync(id, autoShoutout, cancellationToken);

        if (settings is not null)
        {
            logger.LogInformation(
                "Turned the auto shoutout of channel {ChannelId} {State}", id, autoShoutout ? "on" : "off");
        }

        return settings;
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