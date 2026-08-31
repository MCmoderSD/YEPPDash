using System.Net;
using System.Security.Claims;
using YEPPDash.Api.Auth;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Services;

public sealed class TwitchAuthService(
    TwitchOAuthClient oauthClient,
    TwitchApiClient apiClient,
    DatabaseTwitchTokenStore tokenStore,
    ILogger<TwitchAuthService> logger)
{
    private static readonly TimeSpan RefreshMargin = TimeSpan.FromMinutes(5);

    public string BuildLoginUrl(string state)
    {
        return oauthClient.BuildAuthorizationUrl(state);
    }
    
    public async Task<(ClaimsPrincipal Principal, TwitchUser User)> CompleteLoginAsync(string code, CancellationToken cancellationToken)
    {
        var token = await oauthClient.ExchangeCodeAsync(code, cancellationToken);
        var twitchUser = await apiClient.GetCurrentUserAsync(token.AccessToken, cancellationToken);

        await tokenStore.SaveAsync(ToStoredToken(twitchUser.Id, token), cancellationToken);

        logger.LogInformation(
            "Login succeeded via Twitch for {TwitchId} ({Login}), {ScopeCount} scopes granted",
            twitchUser.Id, twitchUser.Login, token.Scope.Length);

        return (BuildPrincipal(twitchUser), twitchUser);
    }

    public async Task<Broadcaster?> GetCurrentUserAsync(string twitchUserId, CancellationToken cancellationToken)
    {
        var token = await GetValidTokenAsync(twitchUserId, cancellationToken);
        if (token is null) return null;

        try
        {
            var profile = apiClient.GetCurrentUserAsync(token.AccessToken, cancellationToken);
            var color = ChatColorAsync(twitchUserId, token.AccessToken, cancellationToken);

            return Broadcaster.From(await profile, await color);
        }
        catch (TwitchOAuthException exception) when (exception.StatusCode == HttpStatusCode.Unauthorized)
        {
            logger.LogWarning("Stored token for {TwitchId} was rejected by Twitch, dropping it", twitchUserId);
            await tokenStore.DeleteAsync(twitchUserId, cancellationToken);
            return null;
        }
    }

    private async Task<string?> ChatColorAsync(string twitchUserId, string accessToken, CancellationToken cancellationToken)
    {
        try
        {
            var colors = await apiClient.GetChatColorsAsync([twitchUserId], accessToken, cancellationToken);
            return colors.Count is 0 ? null : colors[0].Color;
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            logger.LogDebug(exception, "Could not read the chat colour of {TwitchId}", twitchUserId);
            return null;
        }
    }

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
            var refreshed = await oauthClient.RefreshAsync(stored.RefreshToken, cancellationToken);
            var token = ToStoredToken(twitchUserId, refreshed);

            await tokenStore.SaveAsync(token, cancellationToken);
            logger.LogDebug("Refreshed Twitch token for {TwitchId}", twitchUserId);

            return token;
        }
        catch (TwitchOAuthException exception)
        {
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