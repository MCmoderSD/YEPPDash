using System.Net;
using System.Net.Http.Headers;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.Exceptions.Twitch;

namespace YEPPDash.Api.Twitch;

public sealed class TwitchApiClient(HttpClient httpClient, TwitchAuthOptions options)
{
    public const string BaseUrl = "https://api.twitch.tv/helix/";

    public const int MaxBatchSize = 100;

 
    #region Users
    public async Task<TwitchUser> GetCurrentUserAsync(string accessToken, CancellationToken cancellationToken)
    {
        using var response = await SendAsync(HttpMethod.Get, "users", accessToken, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<HelixResponse<TwitchUser>>(TwitchJson.Options, cancellationToken);

        return payload?.Data.FirstOrDefault() ?? throw new TwitchOAuthException("Helix /users returned no user for this token.", HttpStatusCode.NotFound);
    }

    public async Task<IReadOnlyList<TwitchUser>> GetUsersAsync(IReadOnlyCollection<string> userIds, IReadOnlyCollection<string> logins, string accessToken, CancellationToken cancellationToken)
    {
        if (userIds.Count + logins.Count is 0 or > MaxBatchSize)
        {
            throw new ArgumentException($"Get Users takes between 1 and {MaxBatchSize} ids and logins combined.", nameof(userIds));
        }

        var query = string.Join(
            '&',
            userIds.Select(id => $"id={Uri.EscapeDataString(id)}")
                .Concat(logins.Select(login => $"login={Uri.EscapeDataString(login)}")));

        using var response = await SendAsync(HttpMethod.Get, $"users?{query}", accessToken, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<HelixResponse<TwitchUser>>(TwitchJson.Options, cancellationToken);

        return payload?.Data ?? [];
    }

    public async Task<IReadOnlyList<TwitchChatColor>> GetChatColorsAsync(IReadOnlyCollection<string> userIds, string accessToken, CancellationToken cancellationToken)
    {
        if (userIds.Count is 0 or > MaxBatchSize)
        {
            throw new ArgumentException($"Get User Chat Color takes between 1 and {MaxBatchSize} user ids.", nameof(userIds));
        }

        var query = string.Join('&', userIds.Select(id => $"user_id={Uri.EscapeDataString(id)}"));
        using var response = await SendAsync(HttpMethod.Get, $"chat/color?{query}", accessToken, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<HelixResponse<TwitchChatColor>>(TwitchJson.Options, cancellationToken);

        return payload?.Data ?? [];
    }
    #endregion

    #region Moderators
    public Task<HelixPage<TwitchChannelUser>> GetModeratorsAsync(string broadcasterId, string accessToken, string? cursor, CancellationToken cancellationToken)
    {
        return GetPageAsync<TwitchChannelUser>(PagedQuery("moderation/moderators", broadcasterId, cursor), accessToken, cancellationToken);
    }

    public Task<IReadOnlyList<TwitchChannelUser>> GetModeratorsByIdAsync(string broadcasterId, IReadOnlyCollection<string> userIds, string accessToken, CancellationToken cancellationToken)
    {
        return GetFilteredChannelUsersAsync("moderation/moderators", broadcasterId, userIds, accessToken, cancellationToken);
    }

    public Task AddModeratorAsync(string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        return EditChannelAsync(HttpMethod.Post, "moderation/moderators", broadcasterId, userId, accessToken, cancellationToken);
    }

    public Task RemoveModeratorAsync(string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        return EditChannelAsync(HttpMethod.Delete, "moderation/moderators", broadcasterId, userId, accessToken, cancellationToken);
    }
    #endregion

    #region VIPs
    public Task<HelixPage<TwitchChannelUser>> GetVipsAsync(string broadcasterId, string accessToken, string? cursor, CancellationToken cancellationToken)
    {
        return GetPageAsync<TwitchChannelUser>(PagedQuery("channels/vips", broadcasterId, cursor), accessToken, cancellationToken);
    }

    public Task<IReadOnlyList<TwitchChannelUser>> GetVipsByIdAsync(string broadcasterId, IReadOnlyCollection<string> userIds, string accessToken, CancellationToken cancellationToken)
    {
        return GetFilteredChannelUsersAsync("channels/vips", broadcasterId, userIds, accessToken, cancellationToken);
    }

    public Task AddVipAsync(string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        return EditChannelAsync(HttpMethod.Post, "channels/vips", broadcasterId, userId, accessToken, cancellationToken);
    }

    public Task RemoveVipAsync(string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        return EditChannelAsync(HttpMethod.Delete, "channels/vips", broadcasterId, userId, accessToken, cancellationToken);
    }
    #endregion

    #region Editors
    public async Task<IReadOnlyList<TwitchChannelEditor>> GetEditorsAsync(string broadcasterId, string accessToken, CancellationToken cancellationToken)
    {
        var query = $"channels/editors?broadcaster_id={Uri.EscapeDataString(broadcasterId)}";
        using var response = await SendAsync(HttpMethod.Get, query, accessToken, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<HelixResponse<TwitchChannelEditor>>(TwitchJson.Options, cancellationToken);

        return payload?.Data ?? [];
    }

    #endregion

    #region Followers
    public Task<HelixPage<TwitchFollower>> GetFollowersAsync(string broadcasterId, string accessToken, string? cursor, CancellationToken cancellationToken)
    {
        return GetPageAsync<TwitchFollower>(
            PagedQuery("channels/followers", broadcasterId, cursor), accessToken, cancellationToken);
    }

    public async Task<TwitchFollower?> GetFollowerAsync(string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        var query = $"channels/followers?broadcaster_id={Uri.EscapeDataString(broadcasterId)}" +
                    $"&user_id={Uri.EscapeDataString(userId)}";

        var page = await GetPageAsync<TwitchFollower>(query, accessToken, cancellationToken);
        return page.Items.FirstOrDefault();
    }
    #endregion

    #region Bans
    public async Task<TwitchBannedUser?> GetBannedUserAsync(string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        var query = $"moderation/banned?broadcaster_id={Uri.EscapeDataString(broadcasterId)}" +
                    $"&user_id={Uri.EscapeDataString(userId)}";

        var page = await GetPageAsync<TwitchBannedUser>(query, accessToken, cancellationToken);
        return page.Items.FirstOrDefault();
    }

    public async Task UnbanUserAsync(string broadcasterId, string moderatorId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        var query = $"moderation/bans?broadcaster_id={Uri.EscapeDataString(broadcasterId)}" +
                    $"&moderator_id={Uri.EscapeDataString(moderatorId)}" +
                    $"&user_id={Uri.EscapeDataString(userId)}";

        using var response = await SendAsync(HttpMethod.Delete, query, accessToken, cancellationToken);
    }
    #endregion

    #region Blocks
    public Task<HelixPage<TwitchChannelUser>> GetBlockedUsersAsync(string broadcasterId, string accessToken, string? cursor, CancellationToken cancellationToken)
    {
        return GetPageAsync<TwitchChannelUser>(PagedQuery("users/blocks", broadcasterId, cursor), accessToken, cancellationToken);
    }

    public async Task UnblockUserAsync(string userId, string accessToken, CancellationToken cancellationToken)
    {
        var query = $"users/blocks?target_user_id={Uri.EscapeDataString(userId)}";
        using var response = await SendAsync(HttpMethod.Delete, query, accessToken, cancellationToken);
    }
    #endregion

    #region Streams
    /// <summary>
    /// The channel's live stream, or null when it is offline. Needs no scope beyond a valid token,
    /// which is why the channel's own stored token is enough and nothing had to be re-authorized.
    /// </summary>
    public async Task<TwitchStream?> GetStreamAsync(string broadcasterId, string accessToken, CancellationToken cancellationToken)
    {
        var query = $"streams?user_id={Uri.EscapeDataString(broadcasterId)}&first=1";

        var page = await GetPageAsync<TwitchStream>(query, accessToken, cancellationToken);
        return page.Items.FirstOrDefault();
    }
    #endregion

    #region Chat
    public Task<HelixPage<TwitchChannelUser>> GetChattersAsync(string broadcasterId, string accessToken, string? cursor, CancellationToken cancellationToken)
    {
        var query = PagedQuery("chat/chatters", broadcasterId, cursor) +
                    $"&moderator_id={Uri.EscapeDataString(broadcasterId)}";

        return GetPageAsync<TwitchChannelUser>(query, accessToken, cancellationToken);
    }
    #endregion

    private async Task<IReadOnlyList<TwitchChannelUser>> GetFilteredChannelUsersAsync(string path, string broadcasterId, IReadOnlyCollection<string> userIds, string accessToken, CancellationToken cancellationToken)
    {
        if (userIds.Count is 0 or > MaxBatchSize)
        {
            throw new ArgumentException($"Filtering {path} takes between 1 and {MaxBatchSize} user ids.", nameof(userIds));
        }

        var filters = string.Join('&', userIds.Select(id => $"user_id={Uri.EscapeDataString(id)}"));
        var query = $"{PagedQuery(path, broadcasterId, cursor: null)}&{filters}";

        var page = await GetPageAsync<TwitchChannelUser>(query, accessToken, cancellationToken);
        return page.Items;
    }

    private async Task EditChannelAsync(HttpMethod method, string path, string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        var query = $"{path}?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&user_id={Uri.EscapeDataString(userId)}";
        using var response = await SendAsync(method, query, accessToken, cancellationToken);
    }

    private static string PagedQuery(string path, string broadcasterId, string? cursor)
    {
        var query = $"{path}?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&first={MaxBatchSize}";

        return cursor is null ? query : $"{query}&after={Uri.EscapeDataString(cursor)}";
    }

    private async Task<HelixPage<T>> GetPageAsync<T>(string query, string accessToken, CancellationToken cancellationToken)
    {
        using var response = await SendAsync(HttpMethod.Get, query, accessToken, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<HelixResponse<T>>(TwitchJson.Options, cancellationToken);

        var items = payload?.Data ?? [];
        return new HelixPage<T>(items, items.Length == 0 ? null : payload?.Pagination?.Cursor);
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, string accessToken, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("Client-Id", options.ClientId);

        var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode) return response;

        try
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new TwitchOAuthException($"Helix {method} {path} failed ({(int)response.StatusCode}).", response.StatusCode, body);
        }
        finally
        {
            response.Dispose();
        }
    }

    private sealed record HelixResponse<T>
    {
        public T[] Data { get; init; } = [];

        public HelixPagination? Pagination { get; init; }
    }

    private sealed record HelixPagination
    {
        public string? Cursor { get; init; }
    }
}