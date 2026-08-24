using System.Collections.Concurrent;
using SpotifyAPI.Web;
using YEPPDash.Api.Data.Spotify;
using YEPPDash.Api.Exceptions.Spotify;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Spotify;

/// <summary>
/// Hands out one ready-to-use <see cref="ISpotifyClient"/> per channel and keeps it. Building a
/// client is cheap, but the authenticator inside it is not interchangeable: it owns the live access
/// token and the countdown to the next refresh, so a fresh one per request would refresh on every
/// request and burn the rate-limit budget doing it.
/// <para>
/// This is also the reason exactly one process is allowed to talk to Spotify. A refresh can hand
/// back a <em>new</em> refresh token, and two processes refreshing the same connection would each
/// invalidate the other's — with one owner there is nothing to lock and nothing to race.
/// </para>
/// </summary>
public sealed class SpotifyClientCache(
    SpotifyOptions options,
    SpotifyRepository repository,
    ILogger<SpotifyClientCache> logger)
{
    private readonly ConcurrentDictionary<int, Entry> _clients = new();

    public bool Configured => options.Configured;

    public async Task<ISpotifyClient> GetAsync(int channelId, CancellationToken cancellationToken)
    {
        if (!options.Configured) throw new SpotifyNotConfiguredException();

        var connection = await repository.GetConnectionAsync(channelId, cancellationToken)
            ?? throw new SpotifyNotConnectedException(channelId);

        if (connection.Status is SpotifyConnectionStatus.Revoked)
        {
            throw new SpotifyNotConnectedException(channelId);
        }

        // The cached entry is only still valid while it holds the refresh token the row does. They
        // drift apart when the broadcaster reconnects — a second authorization mints a brand new
        // token and the old client would keep quietly using the dead one.
        if (_clients.TryGetValue(channelId, out var cached) && cached.Matches(connection.RefreshToken))
        {
            return cached.Client;
        }

        var entry = Build(channelId, connection);
        _clients[channelId] = entry;

        return entry.Client;
    }

    /// <summary>
    /// Drops a channel's client, so the next call rebuilds from whatever is now in the database.
    /// Called on disconnect: without it a revoked connection would keep working out of memory.
    /// </summary>
    public void Forget(int channelId)
    {
        _clients.TryRemove(channelId, out _);
    }

    private Entry Build(int channelId, SpotifyConnection connection)
    {
        var token = new AuthorizationCodeTokenResponse
        {
            AccessToken = connection.AccessToken ?? string.Empty,
            RefreshToken = connection.RefreshToken,
            TokenType = "Bearer",
            // Deliberately backdated when we have no stored expiry, so the very first call refreshes
            // instead of trying an access token that may already be an hour stale.
            CreatedAt = connection.ExpiresAt?.AddHours(-1) ?? DateTime.UtcNow.AddHours(-1),
            ExpiresIn = 3600
        };

        var authenticator = new AuthorizationCodeAuthenticator(
            options.RequiredClientId, options.RequiredClientSecret, token);

        authenticator.TokenRefreshed += (_, refreshed) => Persist(channelId, refreshed);

        var config = SpotifyClientConfig
            .CreateDefault()
            .WithAuthenticator(authenticator)
            // Spotify's rate limit is a rolling window, and the library already knows how to read
            // Retry-After. Writing that by hand would only be a worse copy of this.
            .WithRetryHandler(new SimpleRetryHandler());

        return new Entry(new SpotifyClient(config), authenticator);
    }

    /// <summary>
    /// The library announces a refresh through a plain event, which cannot be awaited. Persisting on
    /// a detached task is the price of that: the token in memory is already correct, so a failed
    /// write costs one extra refresh after the next restart rather than a broken connection.
    /// </summary>
    private void Persist(int channelId, AuthorizationCodeTokenResponse token)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await repository.SaveTokensAsync(
                    channelId,
                    token.RefreshToken,
                    token.AccessToken,
                    token.CreatedAt.ToUniversalTime().AddSeconds(token.ExpiresIn),
                    CancellationToken.None);

                logger.LogDebug("Refreshed the Spotify token of channel {ChannelId}", channelId);
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception, "Could not store the refreshed Spotify token of channel {ChannelId}", channelId);
            }
        });
    }

    private sealed record Entry(ISpotifyClient Client, AuthorizationCodeAuthenticator Authenticator)
    {
        /// <summary>
        /// The authenticator mutates its own token in place on every refresh, and the same value is
        /// what gets written to the database — so comparing against it is comparing against what we
        /// last stored, without keeping a second copy that could fall behind.
        /// </summary>
        public bool Matches(string refreshToken)
        {
            return string.Equals(Authenticator.InitialToken.RefreshToken, refreshToken, StringComparison.Ordinal);
        }
    }
}
