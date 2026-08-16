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