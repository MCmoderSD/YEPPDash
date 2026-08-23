using System.Collections.Concurrent;
using System.Threading.Channels;

namespace YEPPDash.Api.Services;

public sealed class SubathonTimerSubscription(ChannelReader<string> reader, Action release) : IDisposable
{
    public ChannelReader<string> Reader { get; } = reader;

    public void Dispose()
    {
        release();
    }
}

// Deliberately a copy of WheelHub rather than a shared base class. With two of them the abstraction
// would be guesswork, and the wheel's is the one that has been running in front of viewers; when a
// third overlay turns up, that is the moment to pull them together.
public sealed class SubathonTimerHub
{
    private const int Backlog = 32;

    private readonly ConcurrentDictionary<Guid, Listener> _listeners = new();
    private readonly record struct Listener(int ChannelId, Channel<string> Queue);

    public SubathonTimerSubscription Subscribe(int channelId)
    {
        var id = Guid.NewGuid();
        var queue = Channel.CreateBounded<string>(new BoundedChannelOptions(Backlog)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
        });

        _listeners[id] = new Listener(channelId, queue);

        return new SubathonTimerSubscription(queue.Reader, () => Release(id));
    }

    public void Publish(int channelId, string payload)
    {
        foreach (var (_, listener) in _listeners)
        {
            if (listener.ChannelId == channelId) listener.Queue.Writer.TryWrite(payload);
        }
    }

    // Which channels anyone is actually watching. The wheel never needed this because only a request
    // to this process can change a wheel; the timer is also driven from chat, so a watcher has to go
    // and look. Asking first is what keeps it from touching the database when nobody is watching.
    public IReadOnlyCollection<int> WatchedChannels()
    {
        return [.. _listeners.Values.Select(listener => listener.ChannelId).Distinct()];
    }

    private void Release(Guid id)
    {
        _listeners.TryRemove(id, out _);
    }
}
