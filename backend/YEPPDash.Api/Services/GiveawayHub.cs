using System.Collections.Concurrent;
using System.Threading.Channels;

namespace YEPPDash.Api.Services;

public enum GiveawayAudience
{
    Dashboard,
    Overlay
}

public sealed class GiveawaySubscription(ChannelReader<string> reader, Action release) : IDisposable
{
    public ChannelReader<string> Reader { get; } = reader;

    public void Dispose()
    {
        release();
    }
}

public sealed class GiveawayHub
{
    private const int Backlog = 32;

    private readonly ConcurrentDictionary<Guid, Listener> _listeners = new();

    private readonly record struct Listener(int ChannelId, GiveawayAudience Audience, Channel<string> Queue);

    public GiveawaySubscription Subscribe(int channelId, GiveawayAudience audience)
    {
        var id = Guid.NewGuid();
        var queue = Channel.CreateBounded<string>(new BoundedChannelOptions(Backlog)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true
        });

        _listeners[id] = new Listener(channelId, audience, queue);

        return new GiveawaySubscription(queue.Reader, () => Release(id));
    }

    public void Publish(int channelId, GiveawayAudience audience, string payload)
    {
        foreach (var (_, listener) in _listeners)
        {
            if (listener.ChannelId == channelId && listener.Audience == audience) listener.Queue.Writer.TryWrite(payload);
        }
    }

    private void Release(Guid id)
    {
        _listeners.TryRemove(id, out _);
    }
}