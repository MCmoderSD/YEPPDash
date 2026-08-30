using System.Collections.Concurrent;

namespace YEPPDash.Api.Services;

public enum ChannelRole
{
    Moderator,
    Editor,
    Vip,
    Blocked,
    Follower,
    Banned,
    TimedOut
}

public sealed class TwitchChannelCache
{
    private readonly ConcurrentDictionary<(ChannelRole Role, string BroadcasterId), object> _entries = new();

    private readonly ConcurrentDictionary<(ChannelRole Role, string BroadcasterId), int> _counts = new();

    public IReadOnlyList<T>? Get<T>(ChannelRole role, string broadcasterId)
    {
        return _entries.GetValueOrDefault((role, broadcasterId)) as IReadOnlyList<T>;
    }

    public void Set<T>(ChannelRole role, string broadcasterId, IReadOnlyList<T> entries)
    {
        _entries[(role, broadcasterId)] = entries;
        SetCount(role, broadcasterId, entries.Count);
    }

    public int? GetCount(ChannelRole role, string broadcasterId)
    {
        return _counts.TryGetValue((role, broadcasterId), out var count) ? count : null;
    }

    public void SetCount(ChannelRole role, string broadcasterId, int count)
    {
        _counts[(role, broadcasterId)] = count;
    }

    public void Invalidate(ChannelRole role, string broadcasterId)
    {
        _entries.TryRemove((role, broadcasterId), out _);
        _counts.TryRemove((role, broadcasterId), out _);
    }
}