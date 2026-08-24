namespace YEPPDash.Api.Data.Spotify;

/// <summary>
/// A track reduced to what this application ever shows or decides on. Everything past this — market
/// availability, popularity, external ids — is Spotify's business, and keeping it out means the one
/// library this depends on cannot leak into controllers, chat output or the dashboard.
/// </summary>
public sealed record SpotifyTrack(
    string Id,
    string Uri,
    string Name,
    string Artists,
    IReadOnlyList<string> ArtistIds,
    int DurationMs,
    string? ArtworkUrl
);

public sealed record SpotifyPlayback(
    bool IsPlaying,
    SpotifyTrack? Track,
    int ProgressMs,
    string? Device
)
{
    public static readonly SpotifyPlayback Idle = new(false, null, 0, null);
}

/// <summary>
/// A queued track together with whoever asked for it, where that is known. Tracks the broadcaster
/// queued from the Spotify client themselves have no requester, which is normal rather than a gap.
/// </summary>
public sealed record SpotifyQueueEntry(SpotifyTrack Track, string? RequestedBy);
