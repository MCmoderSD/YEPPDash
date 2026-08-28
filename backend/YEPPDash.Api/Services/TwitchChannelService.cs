using System.Net;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Services;

public sealed class TwitchChannelService(
    TwitchAuthService authService,
    TwitchApiClient apiClient,
    TwitchChannelCache cache,
    TwitchUserCache userCache,
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
        var found = new List<TwitchUser>(userIds.Count);
        var missing = new List<string>();

        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var userId in userIds)
        {
            if (!seen.Add(userId)) continue;

            var cached = userCache.Get(broadcasterId, userId);
            if (cached is null) missing.Add(userId);
            else found.Add(cached);
        }

        if (missing.Count + logins.Count is 0) return found;

        var fetched = await GetUsersAsync(broadcasterId, missing, logins, cancellationToken);
        var enriched = await EnrichAsync(broadcasterId, fetched, cancellationToken);

        foreach (var user in enriched) userCache.Set(broadcasterId, user);

        return [.. found, .. enriched];
    }

    private async Task<IReadOnlyList<TwitchUser>> EnrichAsync(string broadcasterId, IReadOnlyList<TwitchUser> users, CancellationToken cancellationToken)
    {
        if (users.Count is 0) return users;

        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);

        var colorTask = GetChatColorsAsync(users, accessToken, cancellationToken);
        var moderatorTask = GetModeratorsAsync(broadcasterId, cancellationToken);
        var vipTask = GetVipsAsync(broadcasterId, cancellationToken);
        var editorTask = GetEditorsAsync(broadcasterId, cancellationToken);

        await Task.WhenAll(colorTask, moderatorTask, vipTask, editorTask);

        var colors = await colorTask;
        var moderators = (await moderatorTask).Select(moderator => moderator.UserId).ToHashSet(StringComparer.Ordinal);
        var vips = (await vipTask).Select(vip => vip.UserId).ToHashSet(StringComparer.Ordinal);
        var editors = (await editorTask).Select(editor => editor.UserId).ToHashSet(StringComparer.Ordinal);

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

    private async Task<Dictionary<string, string?>> GetChatColorsAsync(IReadOnlyList<TwitchUser> users, string accessToken, CancellationToken cancellationToken)
    {
        var colors = new Dictionary<string, string?>(users.Count, StringComparer.Ordinal);

        foreach (var batch in users.Chunk(TwitchApiClient.MaxBatchSize))
        {
            cancellationToken.ThrowIfCancellationRequested();

            var found = await apiClient.GetChatColorsAsync([.. batch.Select(user => user.Id)], accessToken, cancellationToken);

            foreach (var color in found) colors[color.UserId] = color.Color;
        }

        return colors;
    }
    #endregion

    #region Moderators
    public async Task<IReadOnlyList<TwitchUser>> GetModeratorProfilesAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var moderators = await GetModeratorsAsync(broadcasterId, cancellationToken);
        return await GetUserProfilesAsync(broadcasterId, moderators.Select(moderator => moderator.UserId).ToArray(), [], cancellationToken);
    }

    public async Task<int> GetModeratorCountAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        return cache.GetCount(ChannelRole.Moderator, broadcasterId) ?? (await GetModeratorsAsync(broadcasterId, cancellationToken)).Count;
    }

    public async Task<IReadOnlyList<TwitchUser>> GetModeratorProfilesByIdAsync(
        string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        var moderators = await GetModeratorsByIdAsync(broadcasterId, userIds, cancellationToken);
        return await GetUserProfilesAsync(broadcasterId, moderators.Select(moderator => moderator.UserId).ToArray(), [], cancellationToken);
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
        SetRoleMembership(ChannelRole.Moderator, broadcasterId, userId, member: true);
        userCache.Invalidate(broadcasterId, userId);

        logger.LogInformation("Added {UserId} as moderator in the channel {BroadcasterId}", userId, broadcasterId);
    }

    public async Task RemoveModeratorAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.RemoveModeratorAsync(broadcasterId, userId, accessToken, cancellationToken);
        SetRoleMembership(ChannelRole.Moderator, broadcasterId, userId, member: false);
        userCache.Invalidate(broadcasterId, userId);

        logger.LogInformation("Removed {UserId} as moderator in the channel {BroadcasterId}", userId, broadcasterId);
    }
    #endregion

    #region VIPs
    public async Task<IReadOnlyList<TwitchUser>> GetVipProfilesAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var vips = await GetVipsAsync(broadcasterId, cancellationToken);
        return await GetUserProfilesAsync(broadcasterId, [.. vips.Select(vip => vip.UserId)], [], cancellationToken);
    }

    public async Task<int> GetVipCountAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        return cache.GetCount(ChannelRole.Vip, broadcasterId) ?? (await GetVipsAsync(broadcasterId, cancellationToken)).Count;
    }

    public async Task<IReadOnlyList<TwitchUser>> GetVipProfilesByIdAsync(string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
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
        SetRoleMembership(ChannelRole.Vip, broadcasterId, userId, member: true);
        userCache.Invalidate(broadcasterId, userId);

        logger.LogInformation("Added {UserId} as VIP in the channel {BroadcasterId}", userId, broadcasterId);
    }

    public async Task RemoveVipAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.RemoveVipAsync(broadcasterId, userId, accessToken, cancellationToken);
        SetRoleMembership(ChannelRole.Vip, broadcasterId, userId, member: false);
        userCache.Invalidate(broadcasterId, userId);

        logger.LogInformation("Removed {UserId} as VIP in the channel {BroadcasterId}", userId, broadcasterId);
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

    private async Task<IReadOnlyList<TwitchEditorProfile>> ToEditorProfilesAsync(string broadcasterId, IReadOnlyList<TwitchChannelEditor> editors, CancellationToken cancellationToken)
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
        var editors = await apiClient.GetEditorsAsync(broadcasterId, accessToken, cancellationToken);

        cache.SetCount(ChannelRole.Editor, broadcasterId, editors.Count);

        return editors;
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

        return new FollowStatusResponse(true, users.Count is 0 ? null : new TwitchFollowerProfile(users[0], follow.FollowedAt));
    }

    public async Task<int> GetFollowerCountAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        if (cache.GetCount(ChannelRole.Follower, broadcasterId) is { } remembered) return remembered;

        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        var page = await apiClient.GetFollowersAsync(broadcasterId, accessToken, null, cancellationToken);

        var count = page.Total ?? page.Items.Count;
        cache.SetCount(ChannelRole.Follower, broadcasterId, count);

        return count;
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
        SetRoleMembership(ChannelRole.Blocked, broadcasterId, userId, member: false);
        userCache.Invalidate(broadcasterId, userId);

        logger.LogInformation("Unblocked {UserId} for user {BroadcasterId}", userId, broadcasterId);
    }
    #endregion

    #region Channel
    public async Task<ChannelInformation?> GetChannelAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        var channel = await apiClient.GetChannelAsync(broadcasterId, accessToken, cancellationToken);

        return channel is null ? null : await WithBoxArtAsync(channel, accessToken, cancellationToken);
    }

    public async Task<ChannelInformation?> UpdateChannelAsync(string broadcasterId, ChannelUpdate update, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.ModifyChannelAsync(broadcasterId, update, accessToken, cancellationToken);

        logger.LogInformation("Updated the channel information of {BroadcasterId}", broadcasterId);

        return await GetChannelAsync(broadcasterId, cancellationToken);
    }

    private async Task<ChannelInformation> WithBoxArtAsync(ChannelInformation channel, string accessToken, CancellationToken cancellationToken)
    {
        if (channel.GameId.Length is 0) return channel;

        try
        {
            var games = await apiClient.GetGamesAsync([channel.GameId], accessToken, cancellationToken);
            var boxArtUrl = games.FirstOrDefault()?.BoxArtUrl;

            return string.IsNullOrEmpty(boxArtUrl) ? channel : channel with { BoxArtUrl = boxArtUrl };
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            logger.LogWarning(exception, "Could not look up the box art for game {GameId}", channel.GameId);
            return channel;
        }
    }

    public async Task<IReadOnlyList<ChannelCategory>> GetGamesAsync(string broadcasterId, IReadOnlyCollection<string> gameIds, CancellationToken cancellationToken)
    {
        if (gameIds.Count is 0) return [];

        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        return await apiClient.GetGamesAsync(gameIds, accessToken, cancellationToken);
    }

    public async Task<HelixPage<ChannelCategory>> SearchCategoriesAsync(string broadcasterId, string search, int first, string? cursor, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        return await apiClient.SearchCategoriesAsync(search, first, cursor, accessToken, cancellationToken);
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

    private void SetRoleMembership(ChannelRole role, string broadcasterId, string userId, bool member)
    {
        var cached = cache.Get<TwitchChannelUser>(role, broadcasterId);

        if (cached is not null)
        {
            var updated = cached.Where(entry => !string.Equals(entry.UserId, userId, StringComparison.Ordinal)).ToList();
            if (member) updated.Add(new TwitchChannelUser { UserId = userId });

            cache.Set(role, broadcasterId, updated);
            return;
        }

        if (cache.GetCount(role, broadcasterId) is { } count)
        {
            cache.SetCount(role, broadcasterId, Math.Max(0, member ? count + 1 : count - 1));
        }
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