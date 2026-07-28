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
    TwitchChannelCache cache,
    ILogger<TwitchChannelService> logger)
{
    public async Task<TwitchChatColor?> GetChatColorAsync(
        string twitchUserId, string targetUserId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(twitchUserId, cancellationToken);
        return await apiClient.GetChatColorAsync(targetUserId, accessToken, cancellationToken);
    }

    public async Task<IReadOnlyList<TwitchUser>> GetUsersAsync(
        string twitchUserId,
        IReadOnlyCollection<string> userIds,
        IReadOnlyCollection<string> logins,
        CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(twitchUserId, cancellationToken);
        return await apiClient.GetUsersAsync(userIds, logins, accessToken, cancellationToken);
    }

    public Task<IReadOnlyList<TwitchChannelUser>> GetModeratorsAsync(
        string broadcasterId, CancellationToken cancellationToken)
    {
        return GetChannelUsersAsync(ChannelRole.Moderator, broadcasterId, cancellationToken);
    }

    public Task<IReadOnlyList<TwitchChannelUser>> GetVipsAsync(
        string broadcasterId, CancellationToken cancellationToken)
    {
        return GetChannelUsersAsync(ChannelRole.Vip, broadcasterId, cancellationToken);
    }

    public async Task AddModeratorAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.AddModeratorAsync(broadcasterId, userId, accessToken, cancellationToken);
        cache.Invalidate(ChannelRole.Moderator, broadcasterId);

        logger.LogInformation("Added {UserId} as moderator in channel {BroadcasterId}", userId, broadcasterId);
    }

    public async Task RemoveModeratorAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.RemoveModeratorAsync(broadcasterId, userId, accessToken, cancellationToken);
        cache.Invalidate(ChannelRole.Moderator, broadcasterId);

        logger.LogInformation("Removed {UserId} as moderator in channel {BroadcasterId}", userId, broadcasterId);
    }

    public async Task AddVipAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.AddVipAsync(broadcasterId, userId, accessToken, cancellationToken);
        cache.Invalidate(ChannelRole.Vip, broadcasterId);

        logger.LogInformation("Added {UserId} as VIP in channel {BroadcasterId}", userId, broadcasterId);
    }

    public async Task RemoveVipAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.RemoveVipAsync(broadcasterId, userId, accessToken, cancellationToken);
        cache.Invalidate(ChannelRole.Vip, broadcasterId);

        logger.LogInformation("Removed {UserId} as VIP in channel {BroadcasterId}", userId, broadcasterId);
    }

    // Always costs exactly one request when nothing changed: the first page of 100 is fetched
    // regardless, and if every name on it is already cached the cached list is handed back
    // unchanged. Anything else — an unknown name, a shrunk list, a cold cache — means the cursor
    // gets followed to the end and the whole list is rebuilt.
    private async Task<IReadOnlyList<TwitchChannelUser>> GetChannelUsersAsync(
        ChannelRole role, string broadcasterId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        var page = await FetchPageAsync(role, broadcasterId, accessToken, cursor: null, cancellationToken);

        // No cursor means the first page already is the complete list, so there is nothing to
        // validate against — it simply replaces whatever was cached.
        if (page.Cursor is null)
        {
            cache.Set(role, broadcasterId, page.Items);
            return page.Items;
        }

        var cached = cache.Get(role, broadcasterId);
        if (cached is not null && IsCoveredBy(page.Items, cached))
        {
            logger.LogDebug(
                "Cache for {Role}s of {BroadcasterId} still current ({Count} entries)",
                role, broadcasterId, cached.Count);

            return cached;
        }

        var all = new List<TwitchChannelUser>(page.Items);
        var pages = 1;

        while (page.Cursor is not null)
        {
            cancellationToken.ThrowIfCancellationRequested();

            page = await FetchPageAsync(role, broadcasterId, accessToken, page.Cursor, cancellationToken);
            all.AddRange(page.Items);
            pages++;
        }

        logger.LogInformation(
            "Paginated {Count} {Role}s of channel {BroadcasterId} across {Pages} pages",
            all.Count, role, broadcasterId, pages);

        cache.Set(role, broadcasterId, all);
        return all;
    }

    private Task<HelixPage<TwitchChannelUser>> FetchPageAsync(
        ChannelRole role,
        string broadcasterId,
        string accessToken,
        string? cursor,
        CancellationToken cancellationToken)
    {
        return role is ChannelRole.Moderator
            ? apiClient.GetModeratorsAsync(broadcasterId, accessToken, cursor, cancellationToken)
            : apiClient.GetVipsAsync(broadcasterId, accessToken, cursor, cancellationToken);
    }

    private static bool IsCoveredBy(IReadOnlyList<TwitchChannelUser> page, IReadOnlyList<TwitchChannelUser> cached)
    {
        var known = cached.Select(user => user.UserId).ToHashSet(StringComparer.Ordinal);
        return page.All(user => known.Contains(user.UserId));
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
