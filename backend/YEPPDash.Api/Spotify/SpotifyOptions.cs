using SpotifyAPI.Web;

namespace YEPPDash.Api.Spotify;

public sealed class SpotifyOptions
{
    /// <summary>
    /// Everything the player endpoints need and nothing else. <c>user-read-currently-playing</c> is
    /// already covered by <c>user-read-playback-state</c> and is asked for only so that a reader
    /// does not have to know that.
    /// </summary>
    public static readonly string[] Scopes =
    [
        SpotifyAPI.Web.Scopes.UserReadPlaybackState,
        SpotifyAPI.Web.Scopes.UserModifyPlaybackState,
        SpotifyAPI.Web.Scopes.UserReadCurrentlyPlaying
    ];

    public string? ClientId { get; init; }

    public string? ClientSecret { get; init; }

    /// <summary>
    /// Must be HTTPS or a loopback literal — Spotify rejects <c>http://localhost/...</c> outright
    /// while accepting <c>http://127.0.0.1/...</c>. Since February 2026 a developer gets one client
    /// id, so the loopback and the deployed URI have to live on the same app rather than on two.
    /// </summary>
    public Uri? RedirectUri { get; init; }

    /// <summary>
    /// False on a deployment that never got Spotify credentials. That is not an error: every
    /// Spotify endpoint answers "not configured" and the rest of the dashboard carries on.
    /// </summary>
    public bool Configured =>
        !string.IsNullOrWhiteSpace(ClientId)
        && !string.IsNullOrWhiteSpace(ClientSecret)
        && RedirectUri is not null;

    public string RequiredClientId => ClientId
        ?? throw new InvalidOperationException("Spotify is not configured — check Configured before using the credentials.");

    public string RequiredClientSecret => ClientSecret
        ?? throw new InvalidOperationException("Spotify is not configured — check Configured before using the credentials.");

    public Uri RequiredRedirectUri => RedirectUri
        ?? throw new InvalidOperationException("Spotify is not configured — check Configured before using the credentials.");
}
