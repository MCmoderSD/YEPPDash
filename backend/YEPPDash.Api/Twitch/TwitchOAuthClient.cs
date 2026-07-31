using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.Exceptions.Twitch;

namespace YEPPDash.Api.Twitch;

public sealed class TwitchOAuthClient(HttpClient httpClient, TwitchAuthOptions options)
{
    public const string BaseUrl = "https://id.twitch.tv/";
    
    public string BuildAuthorizationUrl(string state)
    {
        var query = new Dictionary<string, string>
        {
            ["client_id"] = options.ClientId,
            ["redirect_uri"] = options.RedirectUri,
            ["response_type"] = "code",
            ["scope"] = string.Join(' ', options.Scopes),
            ["state"] = state
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

        var token = await response.Content.ReadFromJsonAsync<TwitchTokenResponse>(
            TwitchJson.Options, cancellationToken);
        return token ?? throw new TwitchOAuthException("Twitch token response was empty.", response.StatusCode);
    }
}