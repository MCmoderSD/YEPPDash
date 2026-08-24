using System.Net;
using SpotifyAPI.Web;
using YEPPDash.Api.Data.Spotify;
using YEPPDash.Api.Exceptions.Spotify;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Spotify;

namespace YEPPDash.Api.Services;

/// <summary>
/// The one place that talks to Spotify. Everything above it deals in <see cref="SpotifyTrack"/> and
/// the exceptions in <c>Exceptions.Spotify</c>, never in HTTP status codes — which matters because
/// Spotify reuses them in ways nothing else does: 403 means "no Premium" and 404 means "nothing is
/// playing", not "forbidden" and "no such endpoint".
/// </summary>
public sealed class SpotifyPlaybackService(
    SpotifyClientCache clients,
    SpotifyRepository repository,
    ILogger<SpotifyPlaybackService> logger) : ISpotifyPlaybackService
{
    /// <summary>
    /// Spotify hands out artwork at roughly 640, 300 and 64 pixels. The middle one is what a card in
    /// the dashboard actually renders at; the largest would be a needless download on every poll.
    /// </summary>
    private const int PreferredArtworkSize = 300;

    public Task<SpotifyPlayback> GetPlaybackAsync(int channelId, CancellationToken cancellationToken)
    {
        return CallAsync(channelId, cancellationToken, async client =>
        {
            var context = await client.Player.GetCurrentPlayback(cancellationToken);

            // Spotify answers 204 with no body when nothing is playing at all, which the library
            // surfaces as null rather than as an error.
            if (context is null) return SpotifyPlayback.Idle;

            return new SpotifyPlayback(
                context.IsPlaying,
                ToTrack(context.Item),
                context.ProgressMs,
                context.Device?.Name);
        });
    }

    public Task<IReadOnlyList<SpotifyTrack>> GetQueueAsync(int channelId, CancellationToken cancellationToken)
    {
        return CallAsync(channelId, cancellationToken, async client =>
        {
            var queue = await client.Player.GetQueue(cancellationToken);

            IReadOnlyList<SpotifyTrack> tracks =
            [
                .. (queue?.Queue ?? []).Select(ToTrack).OfType<SpotifyTrack>()
            ];

            return tracks;
        });
    }

    public Task<SpotifyTrack?> GetTrackAsync(int channelId, string trackId, CancellationToken cancellationToken)
    {
        return CallAsync(channelId, cancellationToken, async client =>
        {
            try
            {
                return ToTrack(await client.Tracks.Get(trackId, cancellationToken));
            }
            catch (APIException exception) when (StatusOf(exception) is HttpStatusCode.NotFound)
            {
                // Here, unlike on the player endpoints, a 404 really is "no such track" — a link
                // someone mistyped, or one to a region this account cannot reach.
                return null;
            }
        });
    }

    public Task<IReadOnlyList<SpotifyTrack>> SearchAsync(
        int channelId, string query, int limit, CancellationToken cancellationToken)
    {
        return CallAsync(channelId, cancellationToken, async client =>
        {
            var response = await client.Search.Item(
                new SearchRequest(SearchRequest.Types.Track, query) { Limit = limit }, cancellationToken);

            IReadOnlyList<SpotifyTrack> tracks =
            [
                .. (response.Tracks?.Items ?? []).Select(ToTrack).OfType<SpotifyTrack>()
            ];

            return tracks;
        });
    }

    public Task AddToQueueAsync(int channelId, string uri, CancellationToken cancellationToken)
    {
        return CallAsync(channelId, cancellationToken,
            client => client.Player.AddToQueue(new PlayerAddToQueueRequest(uri), cancellationToken));
    }

    public Task SkipAsync(int channelId, CancellationToken cancellationToken)
    {
        return CallAsync(channelId, cancellationToken, client => client.Player.SkipNext(cancellationToken));
    }

    public Task PlayAsync(int channelId, CancellationToken cancellationToken)
    {
        return CallAsync(channelId, cancellationToken, client => client.Player.ResumePlayback(cancellationToken));
    }

    public Task PauseAsync(int channelId, CancellationToken cancellationToken)
    {
        return CallAsync(channelId, cancellationToken, client => client.Player.PausePlayback(cancellationToken));
    }

    private async Task<T> CallAsync<T>(
        int channelId, CancellationToken cancellationToken, Func<ISpotifyClient, Task<T>> call)
    {
        var client = await clients.GetAsync(channelId, cancellationToken);

        try
        {
            return await call(client);
        }
        catch (APITooManyRequestsException exception)
        {
            // Only reachable once the library's own retry handler has given up, so this is a channel
            // that is genuinely over budget rather than one unlucky call.
            logger.LogWarning(
                "Spotify is rate-limiting channel {ChannelId}, retry after {RetryAfter}",
                channelId, exception.RetryAfter);

            throw new SpotifyRateLimitedException(exception.RetryAfter);
        }
        catch (APIException exception)
        {
            throw await TranslateAsync(channelId, exception);
        }
    }

    private async Task<Exception> TranslateAsync(int channelId, APIException exception)
    {
        switch (StatusOf(exception))
        {
            case HttpStatusCode.Forbidden:
                return new SpotifyPremiumRequiredException();

            case HttpStatusCode.NotFound:
                return new NoActiveDeviceException();

            // The library refreshes on its own, so a 401 that still reaches us means the refresh
            // itself failed — the broadcaster revoked the app, or Spotify retired the token. Either
            // way the stored token is scrap, and leaving the row as CONNECTED would keep the
            // dashboard promising a link that cannot work.
            case HttpStatusCode.Unauthorized:
            case HttpStatusCode.BadRequest:
                logger.LogWarning(
                    exception, "The Spotify connection of channel {ChannelId} was rejected, marking it revoked", channelId);

                await repository.SetStatusAsync(channelId, SpotifyConnectionStatus.Revoked, CancellationToken.None);
                clients.Forget(channelId);

                return new SpotifyNotConnectedException(channelId);

            default:
                logger.LogWarning(exception, "Spotify failed for channel {ChannelId}", channelId);
                return exception;
        }
    }

    private static HttpStatusCode? StatusOf(APIException exception)
    {
        return exception.Response?.StatusCode;
    }

    /// <summary>
    /// Podcast episodes come through the same fields as tracks, and the broadcaster is allowed to be
    /// listening to one. Showing it under a name that says "Track" is a small lie; refusing to show
    /// what is plainly playing would be a bigger one. Requests are a separate matter — those are
    /// rejected before they get here.
    /// </summary>
    private static SpotifyTrack? ToTrack(IPlayableItem? item)
    {
        return item switch
        {
            FullTrack track => ToTrack(track),
            FullEpisode episode => new SpotifyTrack(
                episode.Id,
                episode.Uri,
                episode.Name,
                episode.Show?.Name ?? string.Empty,
                [],
                episode.DurationMs,
                Artwork(episode.Images)),
            _ => null
        };
    }

    private static SpotifyTrack? ToTrack(FullTrack? track)
    {
        if (track is null) return null;

        return new SpotifyTrack(
            track.Id,
            track.Uri,
            track.Name,
            string.Join(", ", track.Artists?.Select(artist => artist.Name) ?? []),
            [.. (track.Artists ?? []).Select(artist => artist.Id)],
            track.DurationMs,
            Artwork(track.Album?.Images));
    }

    private static string? Artwork(IReadOnlyCollection<Image>? images)
    {
        if (images is null || images.Count is 0) return null;

        return images
            .OrderBy(image => Math.Abs(image.Width - PreferredArtworkSize))
            .First()
            .Url;
    }
}
