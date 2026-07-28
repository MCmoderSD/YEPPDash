using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using YEPPDash.Api.Data;

namespace YEPPDash.Api.Twitch;

// Talks to the Helix REST API (https://api.twitch.tv/helix/*) on behalf of a user, using that
// user's access token. Phase 2 grows this with the moderator/ban lookups the join/leave flow needs.
public sealed class TwitchApiClient(HttpClient httpClient, TwitchAuthOptions options)
{
    public const string BaseUrl = "https://api.twitch.tv/helix/";

    // GET /helix/users without parameters resolves the owner of the access token itself, which is
    // exactly what we need right after the code exchange — no user ID known yet at that point.
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

        if (user is null)
        {
            throw new TwitchOAuthException("Helix /users returned no user for this token.", HttpStatusCode.NotFound);
        }

        return user;
    }

    // Every Helix endpoint wraps its payload in {"data":[...]}.
    private sealed record HelixResponse<T>
    {
        [JsonPropertyName("data")]
        public T[] Data { get; init; } = [];
    }
}
