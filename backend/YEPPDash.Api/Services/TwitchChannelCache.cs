using System.Collections.Concurrent;

namespace YEPPDash.Api.Services;

public enum ChannelRole
{
    Moderator,
    Vip,
    Blocked,
    Follower
}

public sealed class TwitchChannelCache
{
    private readonly ConcurrentDictionary<(ChannelRole Role, string BroadcasterId), object> _entries = new();

    public IReadOnlyList<T>? Get<T>(ChannelRole role, string broadcasterId)
    {
        return _entries.GetValueOrDefault((role, broadcasterId)) as IReadOnlyList<T>;
    }

    public void Set<T>(ChannelRole role, string broadcasterId, IReadOnlyList<T> entries)
    {
        _entries[(role, broadcasterId)] = entries;
    }

    public void Invalidate(ChannelRole role, string broadcasterId)
    {
        _entries.TryRemove((role, broadcasterId), out _);
    }
}
