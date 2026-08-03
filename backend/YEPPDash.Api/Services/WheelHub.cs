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

        if (group.IsEmpty) _listeners.TryRemove(channelId, out _);
    }
}