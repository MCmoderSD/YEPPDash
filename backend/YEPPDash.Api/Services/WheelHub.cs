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

public sealed class WheelHub
{
    private const int Backlog = 32;

    // Flat rather than a dictionary of per-channel groups. A group has to be retired once it runs
    // empty, and "is it empty" cannot be decided atomically with a subscriber arriving: the last
    // listener leaves, the check reads empty, a new overlay joins that same group, and only then
    // does the removal land — taking the newcomer with it. The overlay stayed connected and simply
    // never heard anything again, which is the worst way for this to fail.
    //
    // One entry per open connection has no lifetime to get wrong. Publish walks the lot and picks
    // its channel out, which is linear in the number of overlays connected to the whole app rather
    // than to one channel — a handful of held-open SSE connections, against a payload sent only
    // when someone spins a wheel.
    private readonly ConcurrentDictionary<Guid, Listener> _listeners = new();

    private readonly record struct Listener(int ChannelId, Channel<string> Queue);

    public WheelSubscription Subscribe(int channelId)
    {
        var id = Guid.NewGuid();
        var queue = Channel.CreateBounded<string>(new BoundedChannelOptions(Backlog)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
        });

        _listeners[id] = new Listener(channelId, queue);

        return new WheelSubscription(queue.Reader, () => Release(id));
    }

    public void Publish(int channelId, string payload)
    {
        foreach (var (_, listener) in _listeners)
        {
            if (listener.ChannelId == channelId) listener.Queue.Writer.TryWrite(payload);
        }
    }

    public int ListenerCount(int channelId)
    {
        var count = 0;

        foreach (var (_, listener) in _listeners)
        {
            if (listener.ChannelId == channelId) count++;
        }

        return count;
    }

    private void Release(Guid id)
    {
        _listeners.TryRemove(id, out _);
    }
}
