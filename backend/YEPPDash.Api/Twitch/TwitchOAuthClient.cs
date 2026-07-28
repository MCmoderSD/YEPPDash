using System.Net.Http.Json;
using YEPPDash.Api.Data;

namespace YEPPDash.Api.Twitch;

// Thin wrapper around Twitch's OAuth2 endpoints (https://id.twitch.tv/oauth2/*). Deliberately
// dumb: it speaks HTTP and nothing else. Persistence, session handling and refresh scheduling all
// live one layer up in TwitchAuthService.
public sealed class TwitchOAuthClient(HttpClient httpClient, TwitchAuthOptions options)
{
    public const string BaseUrl = "https://id.twitch.tv/";

    // Twitch has no discovery document for the plain OAuth2 flow, so the URL is assembled by hand.
    // Scopes are space-separated per RFC 6749; Uri.EscapeDataString turns that into %20.
    public string BuildAuthorizationUrl(string state)
    {
        var query = new Dictionary<string, string>
        {
            ["client_id"] = options.ClientId,
            ["redirect_uri"] = options.RedirectUri,
            ["response_type"] = "code",
            ["scope"] = string.Join(' ', options.Scopes),
            ["state"] = state
            // force_verify is intentionally omitted: users who already granted these scopes get
            // redirected straight back instead of seeing the consent screen again. Twitch still
            // re-prompts on its own as soon as the requested scope set grows.
        };

        var encoded = query.Select(pair => $"{pair.Key}={Uri.EscapeDataString(pair.Value)}");
        return $"{BaseUrl}oauth2/authorize?{string.Join('&', encoded)}";
    }

    public async Task<TwitchTokenResponse> ExchangeCodeAsync(string code, CancellationToken cancellationToken)
    {
        var form = new Dictionary<string, string>
        {
            ["client_id"] = options.ClientId,
            ["client_secret"] = options.ClientSecret,
            ["code"] = code,
            ["grant_type"] = "authorization_code",
            ["redirect_uri"] = options.RedirectUri
        };

        return await PostTokenRequestAsync(form, cancellationToken);
    }

    public async Task<TwitchTokenResponse> RefreshAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var form = new Dictionary<string, string>
        {
            ["client_id"] = options.ClientId,
            ["client_secret"] = options.ClientSecret,
            ["refresh_token"] = refreshToken,
            ["grant_type"] = "refresh_token"
        };

        return await PostTokenRequestAsync(form, cancellationToken);
    }

    // Best effort — a failing revoke must never block logout, so this swallows transport errors.
    public async Task RevokeAsync(string accessToken, CancellationToken cancellationToken)
    {
        var form = new Dictionary<string, string>
        {
            ["client_id"] = options.ClientId,
            ["token"] = accessToken
        };

        try
        {
            using var response = await httpClient.PostAsync("oauth2/revoke", new FormUrlEncodedContent(form), cancellationToken);
            response.EnsureSuccessStatusCode();
        }
        catch (HttpRequestException)
        {
            // Token stays valid until it expires on its own; the local session is gone either way.
        }
    }

    private async Task<TwitchTokenResponse> PostTokenRequestAsync(
        Dictionary<string, string> form, CancellationToken cancellationToken)
    {
        using var response = await httpClient.PostAsync("oauth2/token", new FormUrlEncodedContent(form), cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new TwitchOAuthException($"Twitch token request failed ({(int)response.StatusCode}).", response.StatusCode, body);
        }

        var token = await response.Content.ReadFromJsonAsync<TwitchTokenResponse>(cancellationToken);
        if (token is null)
        {
            throw new TwitchOAuthException("Twitch token response was empty.", response.StatusCode);
        }

        return token;
    }
}
