using YEPPDash.Api.Data.Spotify;
using YEPPDash.Api.Exceptions.Spotify;
using YEPPDash.Api.Spotify;

namespace YEPPDash.Api.Services;

/// <summary>
/// Keeps every open dashboard's "now playing" honest. Spotify has no way to tell us a track changed,
/// so this asks — but only for channels somebody is watching, and only for what changed.
/// </summary>
public sealed class SpotifyPlaybackWatcher(
    SpotifyPlaybackHub hub,
    SpotifyClientCache clients,
    IServiceScopeFactory scopeFactory,
    ILogger<SpotifyPlaybackWatcher> logger
) : BackgroundService {

    /// <summary>
    /// Slower than the timer's one second, because a progress bar can interpolate between polls and
    /// a track cannot change more often than it plays. Spotify's rate limit is a rolling window of
    /// roughly thirty seconds, and this is the one thing here that runs unattended.
    /// </summary>
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(5);

    /// <summary>
    /// How long the queue may go unread while the same track keeps playing. A track change refreshes
    /// it immediately; this only catches somebody queueing from the Spotify client itself, which no
    /// amount of polling would have caught sooner.
    /// </summary>
    private static readonly TimeSpan QueueRefresh = TimeSpan.FromSeconds(30);

    private readonly Dictionary<int, Watched> _seen = [];

    /// <summary>
    /// Channels already told that the link is gone. Without this, a dashboard left open on a channel
    /// with no Spotify account would be handed the same "disconnected" every five seconds for as
    /// long as the tab stayed open.
    /// </summary>
    private readonly HashSet<int> _announced = [];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!clients.Configured)
        {
            logger.LogInformation("Spotify is not configured, so nothing is being polled for it");
            return;
        }

        using var ticks = new PeriodicTimer(Interval);

        while (await ticks.WaitForNextTickAsync(stoppingToken))
        {
            var watched = hub.WatchedChannels();

            if (watched.Count is 0)
            {
                _seen.Clear();
                _announced.Clear();
                continue;
            }

            try
            {
                await PublishChangesAsync(watched, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Could not check Spotify for changes");
            }
        }
    }

    private async Task PublishChangesAsync(IReadOnlyCollection<int> watched, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();

        var playback = scope.ServiceProvider.GetRequiredService<ISpotifyPlaybackService>();
        var queues = scope.ServiceProvider.GetRequiredService<SpotifyQueueProjection>();

        foreach (var channelId in watched)
        {
            // One channel's Spotify being unreachable must not stop the others being polled, so each
            // is on its own try rather than the loop being on one.
            try
            {
                await PublishChannelAsync(channelId, playback, queues, cancellationToken);
            }
            catch (SpotifyNotConnectedException)
            {
                // Expected the moment a broadcaster disconnects with the page still open. Telling
                // the page beats leaving it showing a track that stopped being true — but telling it
                // once is enough.
                _seen.Remove(channelId);

                if (_announced.Add(channelId)) hub.Publish(channelId, SpotifyEvent.Disconnected);
            }
            catch (SpotifyException exception)
            {
                logger.LogDebug(
                    "Spotify would not answer for channel {ChannelId}: {Reason}", channelId, exception.Reason);
            }
        }

        foreach (var channelId in _seen.Keys.Where(id => !watched.Contains(id)).ToArray())
        {
            _seen.Remove(channelId);
        }

        _announced.RemoveWhere(id => !watched.Contains(id));
    }

    private async Task PublishChannelAsync(
        int channelId,
        ISpotifyPlaybackService playback,
        SpotifyQueueProjection queues,
        CancellationToken cancellationToken)
    {
        var state = await playback.GetPlaybackAsync(channelId, cancellationToken);

        // Answering at all means the link is working, so a later loss is worth announcing again.
        _announced.Remove(channelId);

        _seen.TryGetValue(channelId, out var seen);

        var trackChanged = seen.TrackId != state.Track?.Id;
        var stale = DateTime.UtcNow - seen.QueueReadAt > QueueRefresh;

        var queue = trackChanged || stale
            ? await queues.GetAsync(channelId, SpotifyLimits.QueueLength, cancellationToken)
            : null;

        // Progress is deliberately not part of what counts as a change: it moves every tick by
        // definition, and pushing on it would turn a change feed into a five-second heartbeat that
        // the client can work out for itself from the last payload.
        var changed = trackChanged || seen.IsPlaying != state.IsPlaying || seen.Device != state.Device;

        if (!changed && queue is null) return;

        _seen[channelId] = new Watched(
            state.Track?.Id,
            state.IsPlaying,
            state.Device,
            queue is null ? seen.QueueReadAt : DateTime.UtcNow);

        hub.Publish(channelId, new SpotifyEvent(state, queue));
    }

    private readonly record struct Watched(string? TrackId, bool IsPlaying, string? Device, DateTime QueueReadAt);
}
