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

    /// <summary>
    /// Looks up as many users as asked for, by id or login, in one call.
    /// </summary>
    /// <remarks>
    /// Helix caps Get Users at 100 per request and counts ids and logins against that one limit, so
    /// the two are split together here rather than separately. Callers — and the frontend behind them —
    /// ask for what they want and get it back as one list.
    /// </remarks>
    public async Task<IReadOnlyList<TwitchUser>> GetUsersAsync(
        string twitchUserId,
        IReadOnlyCollection<string> userIds,
        IReadOnlyCollection<string> logins,
        CancellationToken cancellationToken)
    {
        if (userIds.Count + logins.Count is 0) return [];

        var accessToken = await GetAccessTokenAsync(twitchUserId, cancellationToken);

        var keyed = userIds.Select(value => (IsId: true, Value: value))
            .Concat(logins.Select(value => (IsId: false, Value: value)))
            .ToArray();

        var users = new List<TwitchUser>(keyed.Length);

        // Sequential rather than in parallel: Twitch bills every call against the same rate limit,
        // and a wide fan-out only trades one slow request for a throttled one.
        foreach (var batch in keyed.Chunk(TwitchApiClient.MaxBatchSize))
        {
            cancellationToken.ThrowIfCancellationRequested();

            users.AddRange(await apiClient.GetUsersAsync(
                batch.Where(entry => entry.IsId).Select(entry => entry.Value).ToArray(),
                batch.Where(entry => !entry.IsId).Select(entry => entry.Value).ToArray(),
                accessToken,
                cancellationToken));
        }

        return users;
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

    /// <summary>
    /// Which of the given users moderate the channel, however many are asked about.
    /// </summary>
    /// <remarks>
    /// Not served from the cache, and neither is the VIP equivalent below: these exist to answer a
    /// question about specific users, and the cached list is only known to be complete after a full
    /// walk — which is exactly what they avoid.
    /// </remarks>
    public Task<IReadOnlyList<TwitchChannelUser>> GetModeratorsByIdAsync(
        string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        return CheckInBatchesAsync(
            broadcasterId,
            userIds,
            (batch, token) => apiClient.GetModeratorsByIdAsync(broadcasterId, batch, token, cancellationToken),
            cancellationToken);
    }

    /// <summary>
    /// Which of the given users are VIPs of the channel, however many are asked about.
    /// </summary>
    public Task<IReadOnlyList<TwitchChannelUser>> GetVipsByIdAsync(
        string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        return CheckInBatchesAsync(
            broadcasterId,
            userIds,
            (batch, token) => apiClient.GetVipsByIdAsync(broadcasterId, batch, token, cancellationToken),
            cancellationToken);
    }

    // Unpaginated by Helix and never changed through this API — editors are managed on Twitch's own
    // site — so there is one request to make and nothing to invalidate.
    public async Task<IReadOnlyList<TwitchChannelEditor>> GetEditorsAsync(
        string broadcasterId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        return await apiClient.GetEditorsAsync(broadcasterId, accessToken, cancellationToken);
    }

    /// <summary>
    /// Which of the given users are editors of the channel.
    /// </summary>
    /// <remarks>
    /// Twitch offers no filtered form of Get Channel Editors, so the whole list is fetched and matched
    /// here. Two consequences: this is the one membership check with no batch limit, because the ids
    /// never reach Twitch at all — and it is the one that cannot be answered without pulling the full
    /// list. It is still not cached, since an editor added on Twitch's own site has nothing here that
    /// would notice.
    /// </remarks>
    public async Task<IReadOnlyList<TwitchChannelEditor>> GetEditorsByIdAsync(
        string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        if (userIds.Count is 0) return [];

        var wanted = userIds.ToHashSet(StringComparer.Ordinal);
        var editors = await GetEditorsAsync(broadcasterId, cancellationToken);

        return editors.Where(editor => wanted.Contains(editor.UserId)).ToList();
    }

    /// <summary>
    /// Everyone following the channel, walked and cached like the moderator and VIP lists.
    /// </summary>
    /// <remarks>
    /// Nothing here can add a follower, so unlike the other roles there is no write to invalidate the
    /// cache on. Keeping it current rests entirely on the first-page check in
    /// <see cref="GetChannelListAsync{T}"/>, which is worth knowing about: it only notices new entries
    /// that Helix puts on the first page.
    /// </remarks>
    public Task<IReadOnlyList<TwitchFollower>> GetFollowersAsync(
        string broadcasterId, CancellationToken cancellationToken)
    {
        return GetChannelListAsync(
            ChannelRole.Follower,
            broadcasterId,
            (token, cursor) => apiClient.GetFollowersAsync(broadcasterId, token, cursor, cancellationToken),
            follower => follower.UserId,
            cancellationToken);
    }

    public async Task<TwitchFollower?> GetFollowerAsync(
        string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        return await apiClient.GetFollowerAsync(broadcasterId, userId, accessToken, cancellationToken);
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

    // Deliberately uncached: who is in chat turns over constantly, so a remembered list would be
    // wrong almost immediately. Every call pages the live roster from scratch.
    public async Task<IReadOnlyList<TwitchChannelUser>> GetChattersAsync(
        string broadcasterId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);

        var all = new List<TwitchChannelUser>();
        string? cursor = null;
        var pages = 0;

        do
        {
            cancellationToken.ThrowIfCancellationRequested();

            var page = await apiClient.GetChattersAsync(broadcasterId, accessToken, cursor, cancellationToken);
            all.AddRange(page.Items);

            cursor = page.Cursor;
            pages++;
        }
        while (cursor is not null);

        logger.LogInformation(
            "Paginated {Count} chatters of channel {BroadcasterId} across {Pages} pages",
            all.Count, broadcasterId, pages);

        return all;
    }

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

        logger.LogInformation("Unbanned {UserId} in channel {BroadcasterId}", userId, broadcasterId);
    }

    public async Task UnblockUserAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.UnblockUserAsync(userId, accessToken, cancellationToken);
        cache.Invalidate(ChannelRole.Blocked, broadcasterId);

        logger.LogInformation("Unblocked {UserId} for user {BroadcasterId}", userId, broadcasterId);
    }

    /// <summary>
    /// Runs a role membership check over as many users as asked about, 100 per Helix call.
    /// </summary>
    private async Task<IReadOnlyList<TwitchChannelUser>> CheckInBatchesAsync(
        string broadcasterId,
        IReadOnlyCollection<string> userIds,
        Func<IReadOnlyCollection<string>, string, Task<IReadOnlyList<TwitchChannelUser>>> check,
        CancellationToken cancellationToken)
    {
        if (userIds.Count is 0) return [];

        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        var found = new List<TwitchChannelUser>();

        // Sequential for the same reason as Get Users above: the rate limit is shared, so fanning out
        // buys nothing.
        foreach (var batch in userIds.Chunk(TwitchApiClient.MaxBatchSize))
        {
            cancellationToken.ThrowIfCancellationRequested();
            found.AddRange(await check(batch, accessToken));
        }

        return found;
    }

    /// <summary>
    /// Walks a paged channel list to the end, serving the cached one while it is still current.
    /// </summary>
    /// <param name="idOf">
    /// How to read an entry's user id, which is what the freshness check below compares on.
    /// </param>
    private async Task<IReadOnlyList<T>> GetChannelListAsync<T>(
        ChannelRole role,
        string broadcasterId,
        Func<string, string?, Task<HelixPage<T>>> fetchPage,
        Func<T, string> idOf,
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
        if (cached is not null && IsCoveredBy(page.Items, cached, idOf))
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

    /// <summary>
    /// Whether the freshly fetched first page holds nothing the cached list does not already know.
    /// </summary>
    /// <remarks>
    /// This is what saves the whole walk on a warm cache: one page in, and if every entry on it is
    /// familiar the rest is assumed unchanged. It rests on Helix putting new entries on the first
    /// page — something added further in would be missed until the cache is dropped another way.
    /// </remarks>
    private static bool IsCoveredBy<T>(
        IReadOnlyList<T> page, IReadOnlyList<T> cached, Func<T, string> idOf)
    {
        var known = cached.Select(idOf).ToHashSet(StringComparer.Ordinal);
        return page.All(entry => known.Contains(idOf(entry)));
    }

    private async Task<string> GetAccessTokenAsync(string twitchUserId, CancellationToken cancellationToken)
    {
        var token = await authService.GetValidTokenAsync(twitchUserId, cancellationToken);

        return token?.AccessToken ?? throw new TwitchOAuthException($"No usable Twitch token stored for {twitchUserId}.", HttpStatusCode.Unauthorized);
    }
}