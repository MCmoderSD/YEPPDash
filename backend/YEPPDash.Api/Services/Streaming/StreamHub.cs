using System.Collections.Concurrent;
using System.Threading.Channels;

namespace YEPPDash.Api.Services.Streaming;

public enum StreamAudience
{
    Shared,
    Dashboard,
    Overlay
}

public sealed class StreamSubscription(ChannelReader<string> reader, Action release) : IDisposable
{
    public ChannelReader<string> Reader { get; } = reader;

    public void Dispose()
    {
        release();
    }
}

public class StreamHub
{
    private const int Backlog = 32;

    private readonly ConcurrentDictionary<Guid, Listener> _listeners = new();

    private readonly record struct Listener(int ChannelId, StreamAudience Audience, Channel<string> Queue);

    public StreamSubscription Subscribe(int channelId, StreamAudience audience = StreamAudience.Shared)
    {
        var id = Guid.NewGuid();
        var queue = Channel.CreateBounded<string>(new BoundedChannelOptions(Backlog)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true
        });

        _listeners[id] = new Listener(channelId, audience, queue);

        return new StreamSubscription(queue.Reader, () => Release(id));
    }

    public void Publish(int channelId, string payload, StreamAudience audience = StreamAudience.Shared)
    {
        foreach (var (_, listener) in _listeners)
        {
            if (listener.ChannelId == channelId && listener.Audience == audience) listener.Queue.Writer.TryWrite(payload);
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

public sealed class WheelHub : StreamHub;

public sealed class QueueHub : StreamHub;

public sealed class SubathonTimerHub : StreamHub;

public sealed class GiveawayHub : StreamHub;