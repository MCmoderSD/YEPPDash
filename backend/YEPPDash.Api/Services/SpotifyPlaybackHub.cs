using System.Collections.Concurrent;
using System.Text.Json;
using YEPPDash.Api.Data.Spotify;

namespace YEPPDash.Api.Services;

/// <summary>
/// One change worth telling somebody about. A null <see cref="Playback"/> means the link to Spotify
/// is gone; a null <see cref="Queue"/> means the queue was not re-read this time and whatever the
/// client already has still stands.
/// </summary>
public sealed record SpotifyEvent(SpotifyPlayback? Playback, IReadOnlyList<SpotifyQueueEntry>? Queue)
{
    public static readonly SpotifyEvent Disconnected = new(null, null);
}

/// <summary>
/// Where both the dashboard and the public overlay link get their state. A separate type from the
/// generic base so the container can tell the hubs apart — and so the last event can be kept.
/// </summary>
public sealed class SpotifyPlaybackHub : ChannelEventHub<SpotifyEvent>
{
    private readonly ConcurrentDictionary<int, SpotifyEvent> _latest = new();

    /// <summary>
    /// What was last published for this channel, so a browser source that has just been added — or
    /// one that reconnected after OBS was restarted mid-stream — shows the track immediately instead
    /// of sitting blank until the poller's next tick.
    /// </summary>
    public SpotifyEvent? Latest(int channelId)
    {
        return _latest.GetValueOrDefault(channelId);
    }

    public override void Publish(int channelId, SpotifyEvent payload)
    {
        // Kept before the fan-out rather than after, so a subscriber arriving mid-publish cannot see
        // an older retained event than the one already on its way to everybody else.
        _latest[channelId] = Merge(_latest.GetValueOrDefault(channelId), payload);

        base.Publish(channelId, payload);
    }

    /// <summary>
    /// A push that carried no queue leaves the previous one standing, so the retained event stays a
    /// complete picture. Without this, replaying it to a new subscriber would hand them a state whose
    /// queue looked empty purely because the last change happened not to include one.
    /// </summary>
    private static SpotifyEvent Merge(SpotifyEvent? held, SpotifyEvent incoming)
    {
        if (incoming.Playback is null) return incoming;

        return incoming.Queue is null ? incoming with { Queue = held?.Queue } : incoming;
    }
}

public static class SpotifyEvents
{
    private static readonly JsonSerializerOptions EventJson = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// The signed-in broadcaster's view: everything, including which device the music is coming out
    /// of and who asked for what.
    /// <para>
    /// Whole state rather than a delta, which is what makes a duplicate push harmless — and
    /// duplicates do happen, because a dashboard command publishes immediately and the poller finds
    /// the same change a moment later. The queue is left out of the payload entirely when it was not
    /// re-read, since sending null would be indistinguishable from an empty queue.
    /// </para>
    /// </summary>
    public static string ForDashboard(SpotifyEvent change)
    {
        if (change.Playback is not { } playback) return Disconnected();

        return JsonSerializer.Serialize(
            change.Queue is null
                ? new { type = "playback", playback.IsPlaying, playback.Track, playback.ProgressMs, playback.Device }
                : (object)new
                {
                    type = "playback",
                    playback.IsPlaying,
                    playback.Track,
                    playback.ProgressMs,
                    playback.Device,
                    Queue = change.Queue
                },
            EventJson);
    }

    /// <summary>
    /// What the OBS browser source gets, and deliberately less. That link carries no session and
    /// anyone holding it can open it, so it says what is playing — which is about to be audible on
    /// stream anyway — and stops there.
    /// <para>
    /// The device name is the reason this projection exists rather than being the same payload: it is
    /// whatever the speaker or phone is called, which is very often a person's own name, and it has
    /// no business on an unauthenticated URL. The queue and its requester names stay out too.
    /// </para>
    /// </summary>
    public static string ForOverlay(SpotifyEvent change)
    {
        if (change.Playback is not { } playback) return Disconnected();

        return JsonSerializer.Serialize(
            new
            {
                type = "playback",
                playback.IsPlaying,
                Track = playback.Track is null ? null : new
                {
                    playback.Track.Id,
                    playback.Track.Name,
                    playback.Track.Artists,
                    playback.Track.DurationMs,
                    playback.Track.ArtworkUrl
                },
                playback.ProgressMs
            },
            EventJson);
    }

    /// <summary>
    /// Sent when the link to Spotify stops working — a revoked authorization, or a broadcaster who
    /// disconnected in another tab. Both audiences swap to their empty state rather than showing a
    /// frozen track for the rest of the stream.
    /// </summary>
    private static string Disconnected()
    {
        return JsonSerializer.Serialize(new { type = "disconnected" }, EventJson);
    }
}
