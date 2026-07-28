using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using YEPPDash.Api.Data;

namespace YEPPDash.Api.Twitch;

public sealed class TwitchApiClient(HttpClient httpClient, TwitchAuthOptions options)
{
    public const string BaseUrl = "https://api.twitch.tv/helix/";

    public const int MaxBatchSize = 100;

    public async Task<TwitchUser> GetCurrentUserAsync(string accessToken, CancellationToken cancellationToken)
    {
        using var response = await SendAsync(HttpMethod.Get, "users", accessToken, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<HelixResponse<TwitchUser>>(
            TwitchJson.Options, cancellationToken);

        return payload?.Data.FirstOrDefault() ?? throw new TwitchOAuthException("Helix /users returned no user for this token.", HttpStatusCode.NotFound);
    }

    public async Task<IReadOnlyList<TwitchUser>> GetUsersAsync(
        IReadOnlyCollection<string> userIds,
        IReadOnlyCollection<string> logins,
        string accessToken,
        CancellationToken cancellationToken)
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

    public Task<HelixPage<TwitchChannelUser>> GetModeratorsAsync(
        string broadcasterId, string accessToken, string? cursor, CancellationToken cancellationToken)
    {
        return GetChannelUsersAsync("moderation/moderators", broadcasterId, accessToken, cursor, cancellationToken);
    }

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

        var items = payload?.Data ?? [];
        return new HelixPage<TwitchChannelUser>(items, items.Length == 0 ? null : payload?.Pagination?.Cursor);
    }

    public async Task<TwitchChatColor?> GetChatColorAsync(
        string userId, string accessToken, CancellationToken cancellationToken)
    {
        var path = $"chat/color?user_id={Uri.EscapeDataString(userId)}";
        using var response = await SendAsync(HttpMethod.Get, path, accessToken, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<HelixResponse<TwitchChatColor>>(
            TwitchJson.Options, cancellationToken);

        return payload?.Data.FirstOrDefault();
    }

    public Task AddModeratorAsync(
        string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        return EditChannelAsync(HttpMethod.Post, "moderation/moderators", broadcasterId, userId, accessToken, cancellationToken);
    }

    public Task RemoveModeratorAsync(
        string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        return EditChannelAsync(HttpMethod.Delete, "moderation/moderators", broadcasterId, userId, accessToken, cancellationToken);
    }

    public Task AddVipAsync(
        string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        return EditChannelAsync(HttpMethod.Post, "channels/vips", broadcasterId, userId, accessToken, cancellationToken);
    }

    public Task RemoveVipAsync(
        string broadcasterId, string userId, string accessToken, CancellationToken cancellationToken)
    {
        return EditChannelAsync(HttpMethod.Delete, "channels/vips", broadcasterId, userId, accessToken, cancellationToken);
    }

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