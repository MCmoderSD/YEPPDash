namespace YEPPDash.Api.Data.Spotify;

/// <summary>
/// Whether this channel can use Spotify at all, and as whom. <c>Configured</c> is about the server —
/// a deployment without Spotify credentials answers every endpoint with this and nothing else —
/// while <c>Connected</c> is about the broadcaster.
/// </summary>
public sealed record SpotifyStatusResponse(
    bool Configured,
    bool Connected,
    string? DisplayName,
    SpotifyConnectionStatus? Status,
    DateTime? ConnectedAt
)
{
    public static readonly SpotifyStatusResponse NotConfigured = new(false, false, null, null, null);

    public static SpotifyStatusResponse From(SpotifyConnection? connection)
    {
        return connection is null
            ? new SpotifyStatusResponse(true, false, null, null, null)
            : new SpotifyStatusResponse(
                true,
                connection.Status is SpotifyConnectionStatus.Connected,
                connection.DisplayName,
                connection.Status,
                connection.ConnectedAt);
    }
}

/// <summary>
/// What the dashboard renders as "now playing". Deliberately not the queue: the two are polled at
/// different rates and a viewer opening the page cares about the first long before the second.
/// </summary>
public sealed record SpotifyPlaybackResponse(
    bool Connected,
    bool IsPlaying,
    SpotifyTrack? Track,
    int ProgressMs,
    string? Device
)
{
    public static readonly SpotifyPlaybackResponse Disconnected = new(false, false, null, 0, null);

    public static SpotifyPlaybackResponse From(SpotifyPlayback playback)
    {
        return new SpotifyPlaybackResponse(true, playback.IsPlaying, playback.Track, playback.ProgressMs, playback.Device);
    }
}

/// <summary>
/// The bot's flatter view of the same thing. It builds a chat line out of this, so everything it
/// needs is a top-level field and nothing needs walking into.
/// </summary>
public sealed record SpotifyBotStateResponse(
    bool Connected,
    bool IsPlaying,
    string? Track,
    string? Artists,
    int ProgressMs,
    int DurationMs,
    string? Device
)
{
    public static readonly SpotifyBotStateResponse Disconnected = new(false, false, null, null, 0, 0, null);

    public static SpotifyBotStateResponse From(SpotifyPlayback playback)
    {
        return new SpotifyBotStateResponse(
            true,
            playback.IsPlaying,
            playback.Track?.Name,
            playback.Track?.Artists,
            playback.ProgressMs,
            playback.Track?.DurationMs ?? 0,
            playback.Device);
    }
}

public sealed record SpotifyBotQueueEntryResponse(string Track, string Artists, string? RequestedBy)
{
    public static SpotifyBotQueueEntryResponse From(SpotifyQueueEntry entry)
    {
        return new SpotifyBotQueueEntryResponse(entry.Track.Name, entry.Track.Artists, entry.RequestedBy);
    }
}

/// <summary>
/// The answer to a rejected request. <c>RetryAfterSeconds</c> is only ever set for a cooldown, where
/// "wait" is actionable advice rather than a shrug.
/// </summary>
public sealed record SongRequestRejectionResponse(SongRequestReason Reason, int? RetryAfterSeconds);

public sealed record SongRequestAcceptedResponse(string Track, string Artists, string TrackId)
{
    public static SongRequestAcceptedResponse From(SpotifyTrack track)
    {
        return new SongRequestAcceptedResponse(track.Name, track.Artists, track.Id);
    }
}
