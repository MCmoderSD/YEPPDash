using YEPPDash.Api.Data.Spotify;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

/// <summary>
/// Turns Spotify's queue into the short, attributed list the dashboard and chat actually show.
/// </summary>
public sealed class SpotifyQueueProjection(ISpotifyPlaybackService playback, SpotifyRepository repository)
{
    public async Task<IReadOnlyList<SpotifyQueueEntry>> GetAsync(
        int channelId, int limit, CancellationToken cancellationToken)
    {
        var upcoming = Distinct(await playback.GetQueueAsync(channelId, cancellationToken)).Take(limit).ToList();
        if (upcoming.Count is 0) return [];

        var requesters = await repository.GetRequestersAsync(
            channelId,
            [.. upcoming.Select(track => track.Id).Distinct()],
            cancellationToken);

        return
        [
            .. upcoming.Select(track => new SpotifyQueueEntry(track, requesters.GetValueOrDefault(track.Id)))
        ];
    }

    /// <summary>
    /// <c>GET /me/player/queue</c> always answers with twenty entries. Once the real queue is
    /// shorter than that, Spotify fills the rest by walking on into whatever context is playing and
    /// looping it — so the tail is a repeat, not a queue, and showing it would promise the same
    /// track three times.
    /// <para>
    /// Collapsing by id also collapses a track that was genuinely queued twice. That is the wrong
    /// answer in a case nobody notices, traded against the right answer in the case everybody sees.
    /// </para>
    /// </summary>
    private static IEnumerable<SpotifyTrack> Distinct(IEnumerable<SpotifyTrack> tracks)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var track in tracks)
        {
            if (seen.Add(track.Id)) yield return track;
        }
    }
}
