using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using YEPPDash.Api.Data;

namespace YEPPDash.Api.Twitch;

public sealed class TwitchApiClient(HttpClient httpClient, TwitchAuthOptions options)
{
    public const string BaseUrl = "https://api.twitch.tv/helix/";

    // The largest page Twitch serves for the endpoints used here, and the maximum number of
    // ids/logins Get Users accepts in one request.
    public const int MaxBatchSize = 100;

    public async Task<TwitchUser> GetCurrentUserAsync(string accessToken, CancellationToken cancellationToken)
    {
        using var response = await SendAsync(HttpMethod.Get, "users", accessToken, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<HelixResponse<TwitchUser>>(
            TwitchJson.Options, cancellationToken);

        return payload?.Data.FirstOrDefault()
               ?? throw new TwitchOAuthException("Helix /users returned no user for this token.", HttpStatusCode.NotFound);
    }

    // https://dev.twitch.tv/docs/api/reference/#get-users — ids and logins can be mixed freely as
    // long as they add up to at most 100. Twitch silently drops the ones it cannot resolve, so the
    // result may be shorter than the request; matching them back up is the caller's job.
    public async Task<IReadOnlyList<TwitchUser>> GetUsersAsync(
        IReadOnlyCollection<string> userIds,
        IReadOnlyCollection<string> logins,
        string accessToken,
        CancellationToken cancellationToken)
    {
        if (userIds.Count + logins.Count is 0 or > MaxBatchSize)
        {
            throw new ArgumentException(
                $"Get Users takes between 1 and {MaxBatchSize} ids and logins combined.", nameof(userIds));
        }

        var query = string.Join(
            '&',
            userIds.Select(id => $"id={Uri.EscapeDataString(id)}")
                .Concat(logins.Select(login => $"login={Uri.EscapeDataString(login)}")));

        using var response = await SendAsync(HttpMethod.Get, $"users?{query}", accessToken, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<HelixResponse<TwitchUser>>(
            TwitchJson.Options, cancellationToken);

        return payload?.Data ?? [];
    }

    // https://dev.twitch.tv/docs/api/reference/#get-moderators (moderation:read)
    public Task<HelixPage<TwitchChannelUser>> GetModeratorsAsync(
        string broadcasterId, string accessToken, string? cursor, CancellationToken cancellationToken)
    {
        return GetChannelUsersAsync("moderation/moderators", broadcasterId, accessToken, cursor, cancellationToken);
    }

    // https://dev.twitch.tv/docs/api/reference/#get-vips (channel:read:vips)
    public Task<HelixPage<TwitchChannelUser>> GetVipsAsync(
        string broadcasterId, string accessToken, string? cursor, CancellationToken cancellationToken)
    {
        return GetChannelUsersAsync("channels/vips", broadcasterId, accessToken, cursor, cancellationToken);
    }

    private async Task<HelixPage<TwitchChannelUser>> GetChannelUsersAsync(
        string path,
        string broadcasterId,
        string accessToken,
        string? cursor,
        CancellationToken cancellationToken)
    {
        var query = $"{path}?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&first={MaxBatchSize}";
        if (cursor is not null)
        {
            query += $"&after={Uri.EscapeDataString(cursor)}";
        }

        using var response = await SendAsync(HttpMethod.Get, query, accessToken, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<HelixResponse<TwitchChannelUser>>(
            TwitchJson.Options, cancellationToken);

        // Twitch keeps answering with a cursor on the last page, but with an empty data array —
        // treating an empty page as the end is what stops the loop instead of spinning forever.
        var items = payload?.Data ?? [];
        return new HelixPage<TwitchChannelUser>(items, items.Length == 0 ? null : payload?.Pagination?.Cursor);
    }

    // https://dev.twitch.tv/docs/api/reference/#get-user-chat-color — needs no scope, any valid
    // user token works. Twitch answers 200 with an empty data array for an unknown user id, so a
    // null result means "no such user", which is distinct from a user who never picked a colour.
    public async Task<TwitchChatColor?> GetChatColorAsync(
        string userId, string accessToken, CancellationToken cancellationToken)
    {
        var path = $"chat/color?user_id={Uri.EscapeDataString(userId)}";
        using var response = await SendAsync(HttpMethod.Get, path, accessToken, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<HelixResponse<TwitchChatColor>>(
            TwitchJson.Options, cancellationToken);

        return payload?.Data.FirstOrDefault();
    }

    // https://dev.twitch.tv/docs/api/reference/#add-channel-moderator (channel:manage:moderators)
    public Task AddModeratorAsync(
        string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        return EditChannelAsync(HttpMethod.Post, "moderation/moderators", broadcasterId, userId, accessToken, cancellationToken);
    }

    // https://dev.twitch.tv/docs/api/reference/#remove-channel-moderator (channel:manage:moderators)
    public Task RemoveModeratorAsync(
        string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        return EditChannelAsync(HttpMethod.Delete, "moderation/moderators", broadcasterId, userId, accessToken, cancellationToken);
    }

    // https://dev.twitch.tv/docs/api/reference/#add-channel-vip (channel:manage:vips)
    public Task AddVipAsync(
        string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        return EditChannelAsync(HttpMethod.Post, "channels/vips", broadcasterId, userId, accessToken, cancellationToken);
    }

    // https://dev.twitch.tv/docs/api/reference/#remove-channel-vip (channel:manage:vips)
    public Task RemoveVipAsync(
        string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        return EditChannelAsync(HttpMethod.Delete, "channels/vips", broadcasterId, userId, accessToken, cancellationToken);
    }

    // All four moderator/VIP endpoints take the same broadcaster_id + user_id query pair and
    // answer 204 with no body, so there is nothing to deserialize — only failures matter.
    private async Task EditChannelAsync(
        HttpMethod method,
        string path,
        string broadcasterId,
        string userId,
        string accessToken,
        CancellationToken cancellationToken)
    {
        var query = $"{path}?broadcaster_id={Uri.EscapeDataString(broadcasterId)}&user_id={Uri.EscapeDataString(userId)}";
        using var response = await SendAsync(method, query, accessToken, cancellationToken);
    }

    private async Task<HttpResponseMessage> SendAsync(
        HttpMethod method, string path, string accessToken, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("Client-Id", options.ClientId);

        var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode) return response;

        try
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new TwitchOAuthException(
                $"Helix {method} {path} failed ({(int)response.StatusCode}).", response.StatusCode, body);
        }
        finally
        {
            response.Dispose();
        }
    }

    // Every Helix endpoint wraps its payload in {"data":[...]}; paginated ones add a cursor, which
    // is absent (not null) once there is nothing left, hence the nullable object.
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
