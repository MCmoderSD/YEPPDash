using System.Collections.Concurrent;
using System.Threading.Channels;

namespace YEPPDash.Api.Services;

public sealed class QueueSubscription(ChannelReader<string> reader, Action release) : IDisposable
{
    public ChannelReader<string> Reader { get; } = reader;

    public void Dispose()
    {
        release();
    }
}

public sealed class QueueHub
{
    private const int Backlog = 32;

    private readonly ConcurrentDictionary<Guid, Listener> _listeners = new();
    private readonly record struct Listener(int ChannelId, Channel<string> Queue);

    public QueueSubscription Subscribe(int channelId)
    {
        var id = Guid.NewGuid();
        var queue = Channel.CreateBounded<string>(new BoundedChannelOptions(Backlog)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true
        });

        _listeners[id] = new Listener(channelId, queue);

        return new QueueSubscription(queue.Reader, () => Release(id));
    }

    public void Publish(int channelId, string payload)
    {
        foreach (var (_, listener) in _listeners)
        {
            if (listener.ChannelId == channelId) listener.Queue.Writer.TryWrite(payload);
        }
    }

    public IReadOnlyCollection<int> WatchedChannels()
    {
        return [.. _listeners.Values.Select(listener => listener.ChannelId).Distinct()];
    }

    private void Release(Guid id)
    {
        _listeners.TryRemove(id, out _);
    }
}