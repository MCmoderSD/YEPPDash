using System.Net;
using System.Net.Http.Headers;
using System.Text.Json.Serialization;
using YEPPDash.Api.Data;

namespace YEPPDash.Api.Twitch;

public sealed class TwitchApiClient(HttpClient httpClient, TwitchAuthOptions options)
{
    public const string BaseUrl = "https://api.twitch.tv/helix/";

    public async Task<TwitchUser> GetCurrentUserAsync(string accessToken, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "users");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("Client-Id", options.ClientId);

        using var response = await httpClient.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new TwitchOAuthException($"Helix /users failed ({(int)response.StatusCode}).", response.StatusCode, body);
        }

        var payload = await response.Content.ReadFromJsonAsync<HelixResponse<TwitchUser>>(cancellationToken);
        var user = payload?.Data.FirstOrDefault();

        return user ?? throw new TwitchOAuthException("Helix /users returned no user for this token.", HttpStatusCode.NotFound);
    }

    private sealed record HelixResponse<T>
    {
        [JsonPropertyName("data")]
        public T[] Data { get; init; } = [];
    }
}