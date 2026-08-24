using YEPPDash.Api.Data.Spotify;

namespace YEPPDash.Api.Services;

/// <summary>
/// Everything this application asks of Spotify, in this application's own vocabulary. It is an
/// interface for two reasons: a fake of it makes the guards and the bot commands testable without a
/// Premium account and music actually playing, and it is the single surface that would have to be
/// rewritten if <c>SpotifyAPI.Web</c> — a one-maintainer project — ever needed replacing.
/// </summary>
public interface ISpotifyPlaybackService
{
    Task<SpotifyPlayback> GetPlaybackAsync(int channelId, CancellationToken cancellationToken);

    /// <summary>
    /// What Spotify says is coming up, unprocessed. Deduplicating and trimming it is
    /// <c>SpotifyQueueProjection</c>'s job, not this one's.
    /// </summary>
    Task<IReadOnlyList<SpotifyTrack>> GetQueueAsync(int channelId, CancellationToken cancellationToken);

    Task<SpotifyTrack?> GetTrackAsync(int channelId, string trackId, CancellationToken cancellationToken);

    Task<IReadOnlyList<SpotifyTrack>> SearchAsync(int channelId, string query, int limit, CancellationToken cancellationToken);

    Task AddToQueueAsync(int channelId, string uri, CancellationToken cancellationToken);

    Task SkipAsync(int channelId, CancellationToken cancellationToken);

    Task PlayAsync(int channelId, CancellationToken cancellationToken);

    Task PauseAsync(int channelId, CancellationToken cancellationToken);
}
