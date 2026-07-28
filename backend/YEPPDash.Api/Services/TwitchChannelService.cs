using System.Net;
using YEPPDash.Api.Data;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Services;

// Channel-level Helix calls made with the caller's own token. The broadcaster id always comes
// from the session rather than the request, so a caller can only ever edit their own channel —
// the same rule the rest of the public API follows.
public sealed class TwitchChannelService(
    TwitchAuthService authService,
    TwitchApiClient apiClient,
    ILogger<TwitchChannelService> logger)
{
    public async Task<TwitchChatColor?> GetChatColorAsync(
        string twitchUserId, string targetUserId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(twitchUserId, cancellationToken);
        return await apiClient.GetChatColorAsync(targetUserId, accessToken, cancellationToken);
    }

    public async Task AddModeratorAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.AddModeratorAsync(broadcasterId, userId, accessToken, cancellationToken);

        logger.LogInformation("Added {UserId} as moderator in channel {BroadcasterId}", userId, broadcasterId);
    }

    public async Task RemoveModeratorAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.RemoveModeratorAsync(broadcasterId, userId, accessToken, cancellationToken);

        logger.LogInformation("Removed {UserId} as moderator in channel {BroadcasterId}", userId, broadcasterId);
    }

    public async Task AddVipAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.AddVipAsync(broadcasterId, userId, accessToken, cancellationToken);

        logger.LogInformation("Added {UserId} as VIP in channel {BroadcasterId}", userId, broadcasterId);
    }

    public async Task RemoveVipAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.RemoveVipAsync(broadcasterId, userId, accessToken, cancellationToken);

        logger.LogInformation("Removed {UserId} as VIP in channel {BroadcasterId}", userId, broadcasterId);
    }

    // A session without a usable stored token is indistinguishable from an expired one to the
    // caller, so report it the way Twitch itself would rather than inventing a second failure mode.
    private async Task<string> GetAccessTokenAsync(string twitchUserId, CancellationToken cancellationToken)
    {
        var token = await authService.GetValidTokenAsync(twitchUserId, cancellationToken);

        return token?.AccessToken ?? throw new TwitchOAuthException(
            $"No usable Twitch token stored for {twitchUserId}.", HttpStatusCode.Unauthorized);
    }
}
