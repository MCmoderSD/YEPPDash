using System.Collections.Concurrent;
using System.Threading.Channels;

namespace YEPPDash.Api.Services;

public sealed class WheelSubscription(ChannelReader<string> reader, Action release) : IDisposable
{
    public ChannelReader<string> Reader { get; } = reader;

    public void Dispose()
    {
        release();
    }
}

// Carries what happens on a wheel to whoever is watching it. The dashboard and the overlay are two
// browsers — OBS brings its own — so the server is the only thing both of them can see.
//
// Held in memory, which means it reaches the listeners of one API instance. That is what a single
// deployment is; spreading it over several would need the events to travel between them too.
public sealed class WheelHub
{
    // Bounded so an overlay that stopped reading — a scene that is not live, a frozen source —
    // cannot grow without limit. It is dropped from rather than blocking the publisher: a spin
    // nobody read is stale by the time they look again anyway.
    private const int Backlog = 32;

    private readonly ConcurrentDictionary<int, ConcurrentDictionary<Guid, Channel<string>>> _listeners = new();

    public WheelSubscription Subscribe(int channelId)
    {
        var id = Guid.NewGuid();
        var queue = Channel.CreateBounded<string>(new BoundedChannelOptions(Backlog)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
        });

        _listeners.GetOrAdd(channelId, _ => new ConcurrentDictionary<Guid, Channel<string>>()).TryAdd(id, queue);

        return new WheelSubscription(queue.Reader, () => Release(channelId, id));
    }

    public void Publish(int channelId, string payload)
    {
        if (!_listeners.TryGetValue(channelId, out var group)) return;

        foreach (var queue in group.Values) queue.Writer.TryWrite(payload);
    }

    public int ListenerCount(int channelId)
    {
        return _listeners.TryGetValue(channelId, out var group) ? group.Count : 0;
    }

    private void Release(int channelId, Guid id)
    {
        if (!_listeners.TryGetValue(channelId, out var group)) return;

        group.TryRemove(id, out _);

        // A channel nobody listens to any more is taken out rather than left as an empty bucket for
        // every broadcaster that ever opened an overlay.
        if (group.IsEmpty) _listeners.TryRemove(channelId, out _);
    }
}
