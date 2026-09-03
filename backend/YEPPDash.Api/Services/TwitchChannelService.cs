using System.Net;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Helpers;
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
        var ordered = new List<string>(userIds.Count);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var resolved = new Dictionary<string, TwitchUser>(userIds.Count, StringComparer.Ordinal);
        var missing = new List<string>();

        foreach (var userId in userIds)
        {
            if (!seen.Add(userId)) continue;
            ordered.Add(userId);

            var cached = userCache.Get(broadcasterId, userId);
            if (cached is null) missing.Add(userId);
            else resolved[userId] = cached;
        }

        if (missing.Count + logins.Count > 0)
        {
            var fetched = await GetUsersAsync(broadcasterId, missing, logins, cancellationToken);
            var enriched = await EnrichAsync(broadcasterId, fetched, cancellationToken);

            foreach (var user in enriched)
            {
                userCache.Set(broadcasterId, user);

                resolved[user.Id] = user;
                if (seen.Add(user.Id)) ordered.Add(user.Id);
            }
        }

        var profiles = new List<TwitchUser>(ordered.Count);

        foreach (var userId in ordered)
        {
            if (resolved.TryGetValue(userId, out var user)) profiles.Add(user);
        }

        return profiles;
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
                Verified: user.BroadcasterType.Equals("partner", StringComparison.OrdinalIgnoreCase))
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
        return await GetUserProfilesAsync(broadcasterId, [.. moderators.Select(moderator => moderator.UserId)], [], cancellationToken);
    }

    public async Task<int> GetModeratorCountAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        return cache.GetCount(ChannelRole.Moderator, broadcasterId) ?? (await GetModeratorsAsync(broadcasterId, cancellationToken)).Count;
    }

    public async Task<IReadOnlyList<TwitchUser>> GetModeratorProfilesByIdAsync(
        string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        var moderators = await GetModeratorsByIdAsync(broadcasterId, userIds, cancellationToken);
        return await GetUserProfilesAsync(broadcasterId, [.. moderators.Select(moderator => moderator.UserId)], [], cancellationToken);
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

        var vips = await GetVipsByIdAsync(broadcasterId, [userId], cancellationToken);
        if (vips.Count > 0)
        {
            await apiClient.RemoveVipAsync(broadcasterId, userId, accessToken, cancellationToken);
            SetRoleMembership(ChannelRole.Vip, broadcasterId, userId, member: false);

            logger.LogInformation("Removed {UserId} as VIP to make them a moderator in the channel {BroadcasterId}", LogSafe.OneLine(userId), LogSafe.OneLine(broadcasterId));
        }

        await apiClient.AddModeratorAsync(broadcasterId, userId, accessToken, cancellationToken);
        SetRoleMembership(ChannelRole.Moderator, broadcasterId, userId, member: true);
        userCache.Invalidate(broadcasterId, userId);

        logger.LogInformation("Added {UserId} as moderator in the channel {BroadcasterId}", LogSafe.OneLine(userId), LogSafe.OneLine(broadcasterId));
    }

    public async Task RemoveModeratorAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.RemoveModeratorAsync(broadcasterId, userId, accessToken, cancellationToken);
        SetRoleMembership(ChannelRole.Moderator, broadcasterId, userId, member: false);
        userCache.Invalidate(broadcasterId, userId);

        logger.LogInformation("Removed {UserId} as moderator in the channel {BroadcasterId}", LogSafe.OneLine(userId), LogSafe.OneLine(broadcasterId));
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

        var moderators = await GetModeratorsByIdAsync(broadcasterId, [userId], cancellationToken);
        if (moderators.Count > 0)
        {
            await apiClient.RemoveModeratorAsync(broadcasterId, userId, accessToken, cancellationToken);
            SetRoleMembership(ChannelRole.Moderator, broadcasterId, userId, member: false);

            logger.LogInformation("Removed {UserId} as moderator to make them a VIP in the channel {BroadcasterId}", LogSafe.OneLine(userId), LogSafe.OneLine(broadcasterId));
        }

        await apiClient.AddVipAsync(broadcasterId, userId, accessToken, cancellationToken);
        SetRoleMembership(ChannelRole.Vip, broadcasterId, userId, member: true);
        userCache.Invalidate(broadcasterId, userId);

        logger.LogInformation("Added {UserId} as VIP in the channel {BroadcasterId}", LogSafe.OneLine(userId), LogSafe.OneLine(broadcasterId));
    }

    public async Task RemoveVipAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.RemoveVipAsync(broadcasterId, userId, accessToken, cancellationToken);
        SetRoleMembership(ChannelRole.Vip, broadcasterId, userId, member: false);
        userCache.Invalidate(broadcasterId, userId);

        logger.LogInformation("Removed {UserId} as VIP in the channel {BroadcasterId}", LogSafe.OneLine(userId), LogSafe.OneLine(broadcasterId));
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
    // The ban itself, or null for nobody Twitch reports as banned. An account Twitch no longer
    // resolves counts as the latter, the same rule the list and the counts follow — a ban the
    // dashboard cannot show is not one it claims to know about either.
    public async Task<TwitchBanProfile?> GetBanProfileAsync(string broadcasterId, string userId, CancellationToken cancellationToken)
    {
        var ban = await GetBannedUserAsync(broadcasterId, userId, cancellationToken);
        if (ban is null) return null;

        var users = await GetUserProfilesAsync(broadcasterId, [ban.UserId, ban.ModeratorId], [], cancellationToken);
        var byId = users.ToDictionary(user => user.Id, StringComparer.Ordinal);

        return byId.TryGetValue(ban.UserId, out var banned)
            ? new TwitchBanProfile(banned, byId.GetValueOrDefault(ban.ModeratorId), ban.ExpiresAt, ban.CreatedAt, ban.Reason)
            : null;
    }

    public async Task<IReadOnlyList<TwitchBanProfile>> GetBannedProfilesAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var bans = await GetBannedUsersAsync(broadcasterId, cancellationToken);
        if (bans.Count is 0) return [];

        var ids = bans.Select(ban => ban.UserId)
            .Concat(bans.Select(ban => ban.ModeratorId))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var users = await GetUserProfilesAsync(broadcasterId, ids, [], cancellationToken);
        var byId = users.ToDictionary(user => user.Id, StringComparer.Ordinal);
        
        var profiles = bans.Where(ban => byId.ContainsKey(ban.UserId)).ToList();
        CountBans(broadcasterId, profiles);

        return [.. profiles.Select(ban => new TwitchBanProfile(
            byId[ban.UserId],
            byId.GetValueOrDefault(ban.ModeratorId),
            ban.ExpiresAt,
            ban.CreatedAt,
            ban.Reason))];
    }

    public async Task<BanCountResponse> GetBanCountsAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var timeouts = cache.GetCount(ChannelRole.TimedOut, broadcasterId);
        var bans = cache.GetCount(ChannelRole.Banned, broadcasterId);

        if (timeouts is { } knownTimeouts && bans is { } knownBans) return new BanCountResponse(knownTimeouts, knownBans);

        var all = await GetBannedUsersAsync(broadcasterId, cancellationToken);
        if (all.Count is 0) return CountBans(broadcasterId, all);

        var alive = (await GetUsersAsync(broadcasterId, [.. all.Select(ban => ban.UserId).Distinct(StringComparer.Ordinal)], [], cancellationToken))
            .Select(user => user.Id)
            .ToHashSet(StringComparer.Ordinal);

        return CountBans(broadcasterId, [.. all.Where(ban => alive.Contains(ban.UserId))]);
    }

    public async Task<TwitchBanResult> BanUserAsync(string broadcasterId, string userId, long? duration, string? reason, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);

        var ban = new TwitchBanCreate { UserId = userId, Duration = duration, Reason = reason };
        var result = await apiClient.BanUserAsync(broadcasterId, broadcasterId, ban, accessToken, cancellationToken);

        cache.Invalidate(ChannelRole.TimedOut, broadcasterId);
        cache.Invalidate(ChannelRole.Banned, broadcasterId);
        cache.Invalidate(ChannelRole.Moderator, broadcasterId);
        cache.Invalidate(ChannelRole.Vip, broadcasterId);
        userCache.Invalidate(broadcasterId, userId);

        logger.LogInformation(
            "Banned {UserId} in channel {BroadcasterId} until {EndTime}",
            LogSafe.OneLine(userId), LogSafe.OneLine(broadcasterId), result.EndTime?.ToString("O") ?? "forever");

        return result;
    }

    private async Task<IReadOnlyList<TwitchBannedUser>> GetBannedUsersAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);

        var bans = new List<TwitchBannedUser>();
        var page = await apiClient.GetBannedUsersAsync(broadcasterId, accessToken, null, cancellationToken);
        bans.AddRange(page.Items);

        var pages = 1;

        while (page.Cursor is not null)
        {
            cancellationToken.ThrowIfCancellationRequested();

            page = await apiClient.GetBannedUsersAsync(broadcasterId, accessToken, page.Cursor, cancellationToken);
            bans.AddRange(page.Items);
            pages++;
        }

        logger.LogDebug(
            "Paginated {Count} bans of channel {BroadcasterId} across {Pages} pages",
            bans.Count, LogSafe.OneLine(broadcasterId), pages);

        return bans;
    }

    private BanCountResponse CountBans(string broadcasterId, IReadOnlyList<TwitchBannedUser> bans)
    {
        var timeouts = bans.Count(ban => ban.ExpiresAt is not null);
        var permanent = bans.Count - timeouts;

        cache.SetCount(ChannelRole.TimedOut, broadcasterId, timeouts);
        cache.SetCount(ChannelRole.Banned, broadcasterId, permanent);

        return new BanCountResponse(timeouts, permanent);
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

        cache.Invalidate(ChannelRole.TimedOut, broadcasterId);
        cache.Invalidate(ChannelRole.Banned, broadcasterId);

        logger.LogInformation("Unbanned {UserId} in channel {BroadcasterId}", LogSafe.OneLine(userId), LogSafe.OneLine(broadcasterId));
    }
    #endregion

    #region Blocks
    public async Task<IReadOnlyList<TwitchUser>> GetBlockedProfilesAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var blocked = await GetBlockedUsersAsync(broadcasterId, cancellationToken);
        return await GetUserProfilesAsync(broadcasterId, [.. blocked.Select(user => user.UserId)], [], cancellationToken);
    }

    public async Task<IReadOnlyList<TwitchChannelUser>> GetBlockedUsersByIdAsync(string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        if (userIds.Count is 0) return [];

        var wanted = userIds.ToHashSet(StringComparer.Ordinal);
        var blocked = await GetBlockedUsersAsync(broadcasterId, cancellationToken);

        return [.. blocked.Where(user => wanted.Contains(user.UserId))];
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

        logger.LogInformation("Unblocked {UserId} for user {BroadcasterId}", LogSafe.OneLine(userId), LogSafe.OneLine(broadcasterId));
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

        logger.LogInformation("Updated the channel information of {BroadcasterId}", LogSafe.OneLine(broadcasterId));

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

    #region Streams
    public async Task<StreamStatusResponse> GetStreamStatusAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        var stream = await apiClient.GetStreamAsync(broadcasterId, accessToken, cancellationToken);

        return new StreamStatusResponse(stream is not null, stream);
    }
    #endregion

    #region Chat
    public async Task<IReadOnlyList<TwitchUser>> GetChatterProfilesAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var chatters = await GetChattersAsync(broadcasterId, cancellationToken);
        return await GetUserProfilesAsync(broadcasterId, [.. chatters.Select(chatter => chatter.UserId)], [], cancellationToken);
    }

    public async Task<int> GetChatterCountAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        var page = await apiClient.GetChattersAsync(broadcasterId, accessToken, null, cancellationToken);

        return page.Total ?? page.Items.Count;
    }

    public async Task<IReadOnlyList<TwitchChannelUser>> GetChattersByIdAsync(string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        if (userIds.Count is 0) return [];

        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        var wanted = userIds.ToHashSet(StringComparer.Ordinal);
        var found = new List<TwitchChannelUser>();

        string? cursor = null;

        do
        {
            cancellationToken.ThrowIfCancellationRequested();

            var page = await apiClient.GetChattersAsync(broadcasterId, accessToken, cursor, cancellationToken);

            found.AddRange(page.Items.Where(chatter => wanted.Remove(chatter.UserId)));

            if (wanted.Count is 0) break;

            cursor = page.Cursor;
        }
        while (cursor is not null);

        return found;
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
            all.Count, LogSafe.OneLine(broadcasterId), pages);

        return all;
    }
    #endregion

    #region Channel Points
    public async Task<IReadOnlyList<CustomReward>> GetCustomRewardsAsync(string broadcasterId, IReadOnlyCollection<string> rewardIds, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);

        var rewardsTask = apiClient.GetCustomRewardsAsync(broadcasterId, rewardIds, onlyManageable: false, accessToken, cancellationToken);
        var manageableTask = apiClient.GetCustomRewardsAsync(broadcasterId, [], onlyManageable: true, accessToken, cancellationToken);

        var rewards = await rewardsTask;
        var manageable = (await manageableTask).Select(reward => reward.Id).ToHashSet(StringComparer.Ordinal);

        return [.. rewards.Select(reward => reward with { IsManageable = manageable.Contains(reward.Id) })];
    }

    public async Task<CustomReward> CreateCustomRewardAsync(string broadcasterId, CustomRewardCreate create, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        var reward = await apiClient.CreateCustomRewardAsync(broadcasterId, create, accessToken, cancellationToken);

        return reward with { IsManageable = true };
    }

    public async Task<CustomReward> UpdateCustomRewardAsync(string broadcasterId, string rewardId, CustomRewardUpdate update, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        var reward = await apiClient.UpdateCustomRewardAsync(broadcasterId, rewardId, update, accessToken, cancellationToken);

        return reward with { IsManageable = true };
    }

    public async Task DeleteCustomRewardAsync(string broadcasterId, string rewardId, CancellationToken cancellationToken)
    {
        var accessToken = await GetAccessTokenAsync(broadcasterId, cancellationToken);
        await apiClient.DeleteCustomRewardAsync(broadcasterId, rewardId, accessToken, cancellationToken);
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
                role, LogSafe.OneLine(broadcasterId), cached.Count);

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
            all.Count, role, LogSafe.OneLine(broadcasterId), pages);

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