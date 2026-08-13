using System.Net;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Services;

public sealed class TwitchChannelService(
    TwitchAuthService authService,
    TwitchApiClient apiClient,
    TwitchChannelCache cache,
    ILogger<TwitchChannelService> logger
) {

    #region Users
    public async Task<IReadOnlyList<TwitchUser>> GetUsersAsync(string twitchUserId, IReadOnlyCollection<string> userIds, IReadOnlyCollection<string> logins, CancellationToken cancellationToken)
    {
        if (userIds.Count + logins.Count is 0) return [];

        var accessToken = await GetAccessTokenAsync(twitchUserId, cancellationToken);

        var keyed = userIds.Select(value => (IsId: true, Value: value))
            .Concat(logins.Select(value => (IsId: false, Value: value)))
            .ToArray();

        var users = new List<TwitchUser>(keyed.Length);

        foreach (var batch in keyed.Chunk(TwitchApiClient.MaxBatchSize))
        {
            cancellationToken.ThrowIfCancellationRequested();

            users.AddRange(await apiClient.GetUsersAsync(
                [.. batch.Where(entry => entry.IsId).Select(entry => entry.Value)],
                [.. batch.Where(entry => !entry.IsId).Select(entry => entry.Value)],
                accessToken,
                cancellationToken)
            );
        }

        return users;
    }

    public async Task<IReadOnlyList<TwitchUser>> GetUserProfilesAsync(string broadcasterId, IReadOnlyCollection<string> userIds, IReadOnlyCollection<string> logins, CancellationToken cancellationToken)
    {
        var users = await GetUsersAsync(broadcasterId, userIds, logins, cancellationToken);
        return await EnrichAsync(broadcasterId, users, cancellationToken);
    }

    private async Task<IReadOnlyList<TwitchUser>> EnrichAsync(string broadcasterId, IReadOnlyList<TwitchUser> users, CancellationToken cancellationToken)
    {
        if (users.Count is 0) return users;

        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        var colors = new Dictionary<string, string?>(users.Count, StringComparer.Ordinal);

        foreach (var batch in users.Chunk(TwitchApiClient.MaxBatchSize))
        {
            cancellationToken.ThrowIfCancellationRequested();

            var found = await apiClient.GetChatColorsAsync(
                [.. batch.Select(user => user.Id)], accessToken, cancellationToken);

            foreach (var color in found) colors[color.UserId] = color.Color;
        }

        var moderators = (await GetModeratorsAsync(broadcasterId, cancellationToken)).Select(moderator => moderator.UserId).ToHashSet(StringComparer.Ordinal);
        var vips = (await GetVipsAsync(broadcasterId, cancellationToken)).Select(vip => vip.UserId).ToHashSet(StringComparer.Ordinal);
        var editors = (await GetEditorsAsync(broadcasterId, cancellationToken)).Select(editor => editor.UserId).ToHashSet(StringComparer.Ordinal);

        return users.Select(user => user with
        {
            Color = colors.GetValueOrDefault(user.Id),
            Roles = new TwitchUserRoles(
                Broadcaster: string.Equals(user.Id, broadcasterId, StringComparison.Ordinal),
                Moderator: moderators.Contains(user.Id),
                Vip: vips.Contains(user.Id),
                Editor: editors.Contains(user.Id),
                Verified: user.BroadcasterType.Equals("partner", StringComparison.OrdinalIgnoreCase)),
        }).ToList();
    }
    #endregion

    #region Moderators
    public async Task<IReadOnlyList<TwitchUser>> GetModeratorProfilesAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var moderators = await GetModeratorsAsync(broadcasterId, cancellationToken);
        return await GetUserProfilesAsync(
            broadcasterId, moderators.Select(moderator => moderator.UserId).ToArray(), [], cancellationToken);
    }

    public async Task<IReadOnlyList<TwitchUser>> GetModeratorProfilesByIdAsync(
        string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        var moderators = await GetModeratorsByIdAsync(broadcasterId, userIds, cancellationToken);
        return await GetUserProfilesAsync(
            broadcasterId, moderators.Select(moderator => moderator.UserId).ToArray(), [], cancellationToken);
    }

    public Task<IReadOnlyList<TwitchChannelUser>> GetModeratorsAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        return GetChannelListAsync(
            ChannelRole.Moderator,
            broadcasterId,
            (token, cursor) => apiClient.GetModeratorsAsync(broadcasterId, token, cursor, cancellationToken),
            user => user.UserId,
            cancellationToken);
    }

    public Task<IReadOnlyList<TwitchChannelUser>> GetModeratorsByIdAsync(string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        return CheckInBatchesAsync(
            broadcasterId,
            userIds,
            (batch, token) => apiClient.GetModeratorsByIdAsync(broadcasterId, batch, token, cancellationToken),
            cancellationToken);
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
    #endregion

    #region VIPs
    public async Task<IReadOnlyList<TwitchUser>> GetVipProfilesAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var vips = await GetVipsAsync(broadcasterId, cancellationToken);
        return await GetUserProfilesAsync(broadcasterId, [.. vips.Select(vip => vip.UserId)], [], cancellationToken);
    }

    public async Task<IReadOnlyList<TwitchUser>> GetVipProfilesByIdAsync(
        string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        var vips = await GetVipsByIdAsync(broadcasterId, userIds, cancellationToken);
        return await GetUserProfilesAsync(broadcasterId, [.. vips.Select(vip => vip.UserId)], [], cancellationToken);
    }

    public Task<IReadOnlyList<TwitchChannelUser>> GetVipsAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        return GetChannelListAsync(
            ChannelRole.Vip,
            broadcasterId,
            (token, cursor) => apiClient.GetVipsAsync(broadcasterId, token, cursor, cancellationToken),
            user => user.UserId,
            cancellationToken);
    }

    public Task<IReadOnlyList<TwitchChannelUser>> GetVipsByIdAsync(string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        return CheckInBatchesAsync(
            broadcasterId,
            userIds,
            (batch, token) => apiClient.GetVipsByIdAsync(broadcasterId, batch, token, cancellationToken),
            cancellationToken);
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
    #endregion

    #region Editors
    public async Task<IReadOnlyList<TwitchEditorProfile>> GetEditorProfilesAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var editors = await GetEditorsAsync(broadcasterId, cancellationToken);
        return await ToEditorProfilesAsync(broadcasterId, editors, cancellationToken);
    }

    public async Task<IReadOnlyList<TwitchEditorProfile>> GetEditorProfilesByIdAsync(string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        var editors = await GetEditorsByIdAsync(broadcasterId, userIds, cancellationToken);
        return await ToEditorProfilesAsync(broadcasterId, editors, cancellationToken);
    }

    private async Task<IReadOnlyList<TwitchEditorProfile>> ToEditorProfilesAsync(
        string broadcasterId, IReadOnlyList<TwitchChannelEditor> editors, CancellationToken cancellationToken)
    {
        var users = await GetUserProfilesAsync(broadcasterId, [.. editors.Select(editor => editor.UserId)], [], cancellationToken);
        var byId = users.ToDictionary(user => user.Id, StringComparer.Ordinal);
        
        return editors
            .Where(editor => byId.ContainsKey(editor.UserId))
            .Select(editor => new TwitchEditorProfile(byId[editor.UserId], editor.CreatedAt))
            .ToList();
    }

    public async Task<IReadOnlyList<TwitchChannelEditor>> GetEditorsAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        return await apiClient.GetEditorsAsync(broadcasterId, accessToken, cancellationToken);
    }

    public async Task<IReadOnlyList<TwitchChannelEditor>> GetEditorsByIdAsync(string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        if (userIds.Count is 0) return [];

        var wanted = userIds.ToHashSet(StringComparer.Ordinal);
        var editors = await GetEditorsAsync(broadcasterId, cancellationToken);

        return [.. editors.Where(editor => wanted.Contains(editor.UserId))];
    }
    #endregion

    #region Followers
    public async Task<IReadOnlyList<TwitchFollowerProfile>> GetFollowerProfilesAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var followers = await GetFollowersAsync(broadcasterId, cancellationToken);
        var users = await GetUserProfilesAsync(broadcasterId, [.. followers.Select(follower => follower.UserId)], [], cancellationToken);
        var byId = users.ToDictionary(user => user.Id, StringComparer.Ordinal);

        return followers
            .Where(follower => byId.ContainsKey(follower.UserId))
            .Select(follower => new TwitchFollowerProfile(byId[follower.UserId], follower.FollowedAt))
            .ToList();
    }

    public async Task<FollowStatusResponse> GetFollowStatusAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var follow = await GetFollowerAsync(broadcasterId, userId, cancellationToken);
        if (follow is null) return new FollowStatusResponse(false, null);

        var users = await GetUserProfilesAsync(broadcasterId, [follow.UserId], [], cancellationToken);

        return new FollowStatusResponse(
            true, users.Count is 0 ? null : new TwitchFollowerProfile(users[0], follow.FollowedAt));
    }

    public Task<IReadOnlyList<TwitchFollower>> GetFollowersAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        return GetChannelListAsync(
            ChannelRole.Follower,
            broadcasterId,
            (token, cursor) => apiClient.GetFollowersAsync(broadcasterId, token, cursor, cancellationToken),
            follower => follower.UserId,
            cancellationToken);
    }

    public async Task<TwitchFollower?> GetFollowerAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        return await apiClient.GetFollowerAsync(broadcasterId, userId, accessToken, cancellationToken);
    }
    #endregion

    #region Bans
    public async Task<BanStatusResponse> GetBanStatusAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var ban = await GetBannedUserAsync(broadcasterId, userId, cancellationToken);
        if (ban is null) return new BanStatusResponse(false, null);

        var users = await GetUserProfilesAsync(broadcasterId, [ban.UserId, ban.ModeratorId], [], cancellationToken);
        var byId = users.ToDictionary(user => user.Id, StringComparer.Ordinal);

        return byId.TryGetValue(ban.UserId, out var banned)
            ? new BanStatusResponse(true, new TwitchBanProfile(banned, byId.GetValueOrDefault(ban.ModeratorId), ban.ExpiresAt, ban.CreatedAt, ban.Reason))
            : new BanStatusResponse(true, null);
    }

    public async Task<TwitchBannedUser?> GetBannedUserAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        return await apiClient.GetBannedUserAsync(broadcasterId, userId, accessToken, cancellationToken);
    }

    public async Task UnbanUserAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);

        // The token belongs to the broadcaster, so they are their own moderator of record here.
        await apiClient.UnbanUserAsync(broadcasterId, broadcasterId, userId, accessToken, cancellationToken);

        logger.LogInformation("Unbanned {UserId} in channel {BroadcasterId}", userId, broadcasterId);
    }
    #endregion

    #region Blocks
    public async Task<IReadOnlyList<TwitchUser>> GetBlockedProfilesAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var blocked = await GetBlockedUsersAsync(broadcasterId, cancellationToken);
        return await GetUserProfilesAsync(broadcasterId, [.. blocked.Select(user => user.UserId)], [], cancellationToken);
    }

    public Task<IReadOnlyList<TwitchChannelUser>> GetBlockedUsersAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        return GetChannelListAsync(
            ChannelRole.Blocked,
            broadcasterId,
            (token, cursor) => apiClient.GetBlockedUsersAsync(broadcasterId, token, cursor, cancellationToken),
            user => user.UserId,
            cancellationToken);
    }

    public async Task UnblockUserAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.UnblockUserAsync(userId, accessToken, cancellationToken);
        cache.Invalidate(ChannelRole.Blocked, broadcasterId);

        logger.LogInformation("Unblocked {UserId} for user {BroadcasterId}", userId, broadcasterId);
    }
    #endregion

    #region Chat
    public async Task<IReadOnlyList<TwitchUser>> GetChatterProfilesAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var chatters = await GetChattersAsync(broadcasterId, cancellationToken);
        return await GetUserProfilesAsync(broadcasterId, [.. chatters.Select(chatter => chatter.UserId)], [], cancellationToken);
    }

    public async Task<IReadOnlyList<TwitchChannelUser>> GetChattersAsync(string broadcasterId, CancellationToken cancellationToken)
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

        logger.LogDebug(
            "Paginated {Count} chatters of channel {BroadcasterId} across {Pages} pages",
            all.Count, broadcasterId, pages);

        return all;
    }
    #endregion

    private async Task<IReadOnlyList<TwitchChannelUser>> CheckInBatchesAsync(string broadcasterId, IReadOnlyCollection<string> userIds, Func<IReadOnlyCollection<string>, string, Task<IReadOnlyList<TwitchChannelUser>>> check, CancellationToken cancellationToken)
    {
        if (userIds.Count is 0) return [];

        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        var found = new List<TwitchChannelUser>();

        foreach (var batch in userIds.Chunk(TwitchApiClient.MaxBatchSize))
        {
            cancellationToken.ThrowIfCancellationRequested();
            found.AddRange(await check(batch, accessToken));
        }

        return found;
    }

    private async Task<IReadOnlyList<T>> GetChannelListAsync<T>(ChannelRole role, string broadcasterId, Func<string, string?, Task<HelixPage<T>>> fetchPage, Func<T, string> idOf, CancellationToken cancellationToken)
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

        logger.LogDebug(
            "Paginated {Count} {Role}s of channel {BroadcasterId} across {Pages} pages",
            all.Count, role, broadcasterId, pages);

        cache.Set(role, broadcasterId, all);
        return all;
    }

    private static bool IsCoveredBy<T>(IReadOnlyList<T> page, IReadOnlyList<T> cached, Func<T, string> idOf)
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