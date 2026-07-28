using System.Net;
using System.Security.Claims;
using YEPPDash.Api.Auth;
using YEPPDash.Api.Contracts;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Services;

// Orchestrates the OAuth2 authorization-code flow: turns a callback code into a persisted token
// plus a signed-in principal, and keeps that token usable afterwards. The controller stays free of
// Twitch specifics; everything below only ever speaks HTTP or SQL.
public sealed class TwitchAuthService(
    TwitchOAuthClient oauthClient,
    TwitchApiClient apiClient,
    ITwitchTokenStore tokenStore,
    ILogger<TwitchAuthService> logger)
{
    // Refresh a little before the token actually dies, so a request never races the expiry.
    private static readonly TimeSpan RefreshMargin = TimeSpan.FromMinutes(5);

    public string BuildLoginUrl(string state)
    {
        return oauthClient.BuildAuthorizationUrl(state);
    }

    // Code exchange plus the identity lookup that replaces the OIDC id_token: one extra HTTP call,
    // and in return the access token needed for every later Helix operation is already in hand.
    public async Task<(ClaimsPrincipal Principal, UserInfo User)> CompleteLoginAsync(
        string code, CancellationToken cancellationToken)
    {
        var token = await oauthClient.ExchangeCodeAsync(code, cancellationToken);
        var twitchUser = await apiClient.GetCurrentUserAsync(token.AccessToken, cancellationToken);

        await tokenStore.SaveAsync(ToStoredToken(twitchUser.Id, token), cancellationToken);

        logger.LogInformation(
            "Login succeeded via Twitch for {TwitchId} ({Login}), {ScopeCount} scopes granted",
            twitchUser.Id, twitchUser.Login, token.Scope.Length);

        return (BuildPrincipal(twitchUser), ToUserInfo(twitchUser));
    }

    // Called on every /api/auth/me. Re-reading the profile is the point: login, display name,
    // avatar and e-mail can all change between sessions, and only the ID is guaranteed stable.
    public async Task<UserInfo?> GetCurrentUserAsync(string twitchUserId, CancellationToken cancellationToken)
    {
        var token = await GetValidTokenAsync(twitchUserId, cancellationToken);
        if (token is null)
        {
            return null;
        }

        try
        {
            var twitchUser = await apiClient.GetCurrentUserAsync(token.AccessToken, cancellationToken);
            return ToUserInfo(twitchUser);
        }
        catch (TwitchOAuthException exception) when (exception.StatusCode == HttpStatusCode.Unauthorized)
        {
            logger.LogWarning("Stored token for {TwitchId} was rejected by Twitch, dropping it", twitchUserId);
            await tokenStore.DeleteAsync(twitchUserId, cancellationToken);
            return null;
        }
    }

    // Returns a token that is valid right now, refreshing transparently when it is about to expire.
    // Phase 2 (join/leave, moderator management) calls this before every Helix write.
    public async Task<StoredTwitchToken?> GetValidTokenAsync(string twitchUserId, CancellationToken cancellationToken)
    {
        var stored = await tokenStore.GetAsync(twitchUserId, cancellationToken);
        if (stored is null)
        {
            return null;
        }

        if (stored.ExpiresAt - RefreshMargin > DateTimeOffset.UtcNow)
        {
            return stored;
        }

        try
        {
            // Twitch may hand back a *new* refresh token here, so the stored row must be replaced
            // rather than only updated with the access token.
            var refreshed = await oauthClient.RefreshAsync(stored.RefreshToken, cancellationToken);
            var token = ToStoredToken(twitchUserId, refreshed);

            await tokenStore.SaveAsync(token, cancellationToken);
            logger.LogInformation("Refreshed Twitch token for {TwitchId}", twitchUserId);

            return token;
        }
        catch (TwitchOAuthException exception)
        {
            // A refusal here means the grant is gone for good (password change, app disconnected,
            // revoked token) — keeping the row would only produce the same failure on every call.
            logger.LogWarning(
                "Refreshing the Twitch token for {TwitchId} failed ({StatusCode}), dropping it",
                twitchUserId, exception.StatusCode);

            await tokenStore.DeleteAsync(twitchUserId, cancellationToken);
            return null;
        }
    }

    public async Task SignOutAsync(string twitchUserId, CancellationToken cancellationToken)
    {
        var stored = await tokenStore.GetAsync(twitchUserId, cancellationToken);
        if (stored is not null)
        {
            await oauthClient.RevokeAsync(stored.AccessToken, cancellationToken);
        }

        await tokenStore.DeleteAsync(twitchUserId, cancellationToken);
    }

    private static StoredTwitchToken ToStoredToken(string twitchUserId, TwitchTokenResponse token)
    {
        return new StoredTwitchToken(
            twitchUserId,
            token.AccessToken,
            token.RefreshToken,
            token.Scope,
            DateTimeOffset.UtcNow.AddSeconds(token.ExpiresIn));
    }

    private static UserInfo ToUserInfo(TwitchUser user)
    {
        return new UserInfo(user.Id, user.Login, user.DisplayName, user.Email, user.ProfileImageUrl);
    }

    // The session cookie only carries the Twitch ID (plus the login as a display fallback for when
    // Twitch is unreachable). Everything else is looked up live, so nothing in the cookie can go stale.
    private static ClaimsPrincipal BuildPrincipal(TwitchUser user)
    {
        var identity = new ClaimsIdentity(
            [
                new Claim(TwitchClaimTypes.TwitchId, user.Id),
                new Claim(TwitchClaimTypes.Login, user.Login)
            ],
            authenticationType: "Twitch",
            nameType: TwitchClaimTypes.Login,
            roleType: ClaimTypes.Role);

        return new ClaimsPrincipal(identity);
    }
}
