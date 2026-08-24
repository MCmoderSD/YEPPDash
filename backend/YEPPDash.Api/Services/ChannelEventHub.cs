using System.Collections.Concurrent;
using System.Threading.Channels;

namespace YEPPDash.Api.Services;

public sealed class ChannelEventSubscription<T>(ChannelReader<T> reader, Action release) : IDisposable
{
    public ChannelReader<T> Reader { get; } = reader;

    public void Dispose()
    {
        release();
    }
}

/// <summary>
/// A fan-out of events, keyed by channel: whoever is listening to a channel gets what is published
/// to it, and nothing else. Like the wheel's and the timer's hubs, this assumes a single backend
/// instance — there is no backplane, and <c>docker-compose.yaml</c> runs exactly one.
/// <para>
/// Carries the event itself rather than a finished string, because one publish can have more than
/// one audience: the dashboard is shown what device the music is playing on, and the public overlay
/// link deliberately is not. Serializing per subscriber is what keeps the second from ever holding
/// the first's payload.
/// </para>
/// <para>
/// The wheel and the timer each grew their own copy of this before it was clear the shape would
/// repeat. Migrating them onto this one is a separate change, not something a Spotify branch should
/// be doing.
/// </para>
/// </summary>
public abstract class ChannelEventHub<T>
{
    /// <summary>
    /// Deep enough that a listener catching up never misses a state change, shallow enough that a
    /// listener which has stopped reading altogether cannot hold memory indefinitely. The oldest
    /// message is dropped first, which is the right one to lose: every payload is a full state.
    /// </summary>
    private const int Backlog = 32;

    private readonly ConcurrentDictionary<Guid, Listener> _listeners = new();

    private readonly record struct Listener(int ChannelId, Channel<T> Queue);

    public ChannelEventSubscription<T> Subscribe(int channelId)
    {
        var id = Guid.NewGuid();
        var queue = Channel.CreateBounded<T>(new BoundedChannelOptions(Backlog)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
        });

        _listeners[id] = new Listener(channelId, queue);

        return new ChannelEventSubscription<T>(queue.Reader, () => Release(id));
    }

    public virtual void Publish(int channelId, T payload)
    {
        foreach (var (_, listener) in _listeners)
        {
            if (listener.ChannelId == channelId) listener.Queue.Writer.TryWrite(payload);
        }
    }

    /// <summary>
    /// The channels somebody is actually watching. A poller asks this first so that an idle
    /// deployment costs nothing at all rather than a request per channel per tick.
    /// </summary>
    public IReadOnlyCollection<int> WatchedChannels()
    {
        return [.. _listeners.Values.Select(listener => listener.ChannelId).Distinct()];
    }

    private void Release(Guid id)
    {
        _listeners.TryRemove(id, out _);
    }
}
