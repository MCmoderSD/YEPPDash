using System.Net;
using YEPPDash.Api.Data;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Services;

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
        return GetChannelListAsync(
            ChannelRole.Moderator,
            broadcasterId,
            (token, cursor) => apiClient.GetModeratorsAsync(broadcasterId, token, cursor, cancellationToken),
            user => user.UserId,
            cancellationToken);
    }

    public Task<IReadOnlyList<TwitchChannelUser>> GetVipsAsync(
        string broadcasterId, CancellationToken cancellationToken)
    {
        return GetChannelListAsync(
            ChannelRole.Vip,
            broadcasterId,
            (token, cursor) => apiClient.GetVipsAsync(broadcasterId, token, cursor, cancellationToken),
            user => user.UserId,
            cancellationToken);
    }

    public Task<IReadOnlyList<TwitchChannelUser>> GetBlockedUsersAsync(
        string broadcasterId, CancellationToken cancellationToken)
    {
        return GetChannelListAsync(
            ChannelRole.Blocked,
            broadcasterId,
            (token, cursor) => apiClient.GetBlockedUsersAsync(broadcasterId, token, cursor, cancellationToken),
            user => user.UserId,
            cancellationToken);
    }

    public Task<IReadOnlyList<TwitchBannedUser>> GetBannedUsersAsync(
        string broadcasterId, CancellationToken cancellationToken)
    {
        return GetChannelListAsync(
            ChannelRole.Banned,
            broadcasterId,
            (token, cursor) => apiClient.GetBannedUsersAsync(broadcasterId, token, cursor, cancellationToken),
            user => user.UserId,
            cancellationToken);
    }

    // Deliberately asks Twitch instead of reading the cached list: a single filtered call is cheap,
    // and a stale "not banned" is a worse answer than a slightly slower one.
    public async Task<TwitchBannedUser?> GetBannedUserAsync(
        string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        return await apiClient.GetBannedUserAsync(broadcasterId, userId, accessToken, cancellationToken);
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

    public async Task UnbanUserAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);

        // The token belongs to the broadcaster, so they are their own moderator of record here.
        await apiClient.UnbanUserAsync(broadcasterId, broadcasterId, userId, accessToken, cancellationToken);
        cache.Invalidate(ChannelRole.Banned, broadcasterId);

        logger.LogInformation("Unbanned {UserId} in channel {BroadcasterId}", userId, broadcasterId);
    }

    public async Task UnblockUserAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.UnblockUserAsync(userId, accessToken, cancellationToken);
        cache.Invalidate(ChannelRole.Blocked, broadcasterId);

        logger.LogInformation("Unblocked {UserId} for user {BroadcasterId}", userId, broadcasterId);
    }

    private async Task<IReadOnlyList<T>> GetChannelListAsync<T>(
        ChannelRole role,
        string broadcasterId,
        Func<string, string?, Task<HelixPage<T>>> fetchPage,
        Func<T, string> userId,
        CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        var page = await fetchPage(accessToken, null);

        if (page.Cursor is null)
        {
            cache.Set(role, broadcasterId, page.Items);
            return page.Items;
        }

        var cached = cache.Get<T>(role, broadcasterId);
        if (cached is not null && IsCoveredBy(page.Items, cached, userId))
        {
            logger.LogDebug(
                "Cache for {Role}s of {BroadcasterId} still current ({Count} entries)",
                role, broadcasterId, cached.Count);

            return cached;
        }

        var all = new List<T>(page.Items);
        var pages = 1;

        while (page.Cursor is not null)
        {
            cancellationToken.ThrowIfCancellationRequested();

            page = await fetchPage(accessToken, page.Cursor);
            all.AddRange(page.Items);
            pages++;
        }

        logger.LogInformation(
            "Paginated {Count} {Role}s of channel {BroadcasterId} across {Pages} pages",
            all.Count, role, broadcasterId, pages);

        cache.Set(role, broadcasterId, all);
        return all;
    }

    private static bool IsCoveredBy<T>(
        IReadOnlyList<T> page, IReadOnlyList<T> cached, Func<T, string> userId)
    {
        var known = cached.Select(userId).ToHashSet(StringComparer.Ordinal);
        return page.All(user => known.Contains(userId(user)));
    }

    private async Task<string> GetAccessTokenAsync(string twitchUserId, CancellationToken cancellationToken)
    {
        var token = await authService.GetValidTokenAsync(twitchUserId, cancellationToken);

        return token?.AccessToken ?? throw new TwitchOAuthException($"No usable Twitch token stored for {twitchUserId}.", HttpStatusCode.Unauthorized);
    }
}