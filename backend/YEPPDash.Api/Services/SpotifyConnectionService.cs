using SpotifyAPI.Web;
using YEPPDash.Api.Data.Spotify;
using YEPPDash.Api.Exceptions.Spotify;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Spotify;

namespace YEPPDash.Api.Services;

/// <summary>
/// The authorization half: getting a broadcaster linked once, and keeping that link on disk. After
/// this has run, nothing about Spotify needs the broadcaster to be present — which is the whole
/// point, since chat drives the feature while nobody is looking at the dashboard.
/// </summary>
public sealed class SpotifyConnectionService(
    SpotifyOptions options,
    SpotifyRepository repository,
    SpotifyClientCache clients,
    ILogger<SpotifyConnectionService> logger)
{
    public bool Configured => options.Configured;

    /// <summary>
    /// Where the broadcaster's browser is sent. Authorization Code, not Implicit — the latter is
    /// deprecated — and not PKCE either, because this is a confidential client: the secret never
    /// leaves the server, so there is nothing for PKCE to protect against.
    /// </summary>
    public Uri BuildConnectUrl(string state)
    {
        if (!options.Configured) throw new SpotifyNotConfiguredException();

        return new LoginRequest(options.RequiredRedirectUri, options.RequiredClientId, LoginRequest.ResponseType.Code)
        {
            Scope = SpotifyOptions.Scopes,
            State = state
        }.ToUri();
    }

    public async Task<SpotifyStatusResponse> GetStatusAsync(int channelId, CancellationToken cancellationToken)
    {
        if (!options.Configured) return SpotifyStatusResponse.NotConfigured;

        return SpotifyStatusResponse.From(await repository.GetConnectionAsync(channelId, cancellationToken));
    }

    public async Task<SpotifyConnection> CompleteAsync(int channelId, string code, CancellationToken cancellationToken)
    {
        if (!options.Configured) throw new SpotifyNotConfiguredException();

        // Built per connect rather than held: this runs twice in a broadcaster's lifetime, and a
        // long-lived OAuth client would be one more thing to keep alive for no benefit.
        var oauth = new OAuthClient();

        var token = await oauth.RequestToken(
            new AuthorizationCodeTokenRequest(
                options.RequiredClientId, options.RequiredClientSecret, code, options.RequiredRedirectUri),
            cancellationToken);

        var profile = await ProfileAsync(token, cancellationToken);

        var connection = new SpotifyConnection(
            channelId,
            profile.Id,
            // A Spotify account without a display name is unusual but allowed, and an empty card in
            // the dashboard reads as a bug rather than as a quirk of the account.
            string.IsNullOrWhiteSpace(profile.DisplayName) ? profile.Id : profile.DisplayName,
            token.RefreshToken,
            token.AccessToken,
            token.CreatedAt.ToUniversalTime().AddSeconds(token.ExpiresIn),
            DateTime.UtcNow,
            SpotifyConnectionStatus.Connected);

        await repository.SaveConnectionAsync(connection, cancellationToken);

        // A reconnect mints a new refresh token, and the cached client is still holding the old one.
        clients.Forget(channelId);

        logger.LogInformation(
            "Channel {ChannelId} linked the Spotify account {DisplayName}", channelId, connection.DisplayName);

        return connection;
    }

    public async Task<bool> DisconnectAsync(int channelId, CancellationToken cancellationToken)
    {
        var removed = await repository.DeleteConnectionAsync(channelId, cancellationToken);

        // Order matters the other way round would not: forgetting first leaves a window in which a
        // concurrent call rebuilds the client from the row that is about to be deleted.
        clients.Forget(channelId);

        if (removed) logger.LogInformation("Channel {ChannelId} unlinked its Spotify account", channelId);

        return removed;
    }

    /// <summary>
    /// Reads the account back so the dashboard has a name to show. This is not a Premium check —
    /// Spotify removed <c>product</c> from this response in February 2026, and a missing
    /// subscription now only ever surfaces as a 403 on the first playback call.
    /// </summary>
    private static async Task<PrivateUser> ProfileAsync(
        AuthorizationCodeTokenResponse token, CancellationToken cancellationToken)
    {
        var client = new SpotifyClient(SpotifyClientConfig.CreateDefault(token.AccessToken));

        return await client.UserProfile.Current(cancellationToken);
    }
}
