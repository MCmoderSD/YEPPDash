using System.Collections.Concurrent;

namespace YEPPDash.Api.Services;

public enum ChannelRole
{
    Moderator,
    Vip,
    Blocked,
    Banned
}

public sealed class TwitchChannelCache
{
    // Each entry is the IReadOnlyList<T> belonging to its role: bans carry an expiry, a reason and
    // the moderator who issued them, so they cannot share a list type with the other three.
    private readonly ConcurrentDictionary<(ChannelRole Role, string BroadcasterId), object> _entries = new();

    public IReadOnlyList<T>? Get<T>(ChannelRole role, string broadcasterId)
    {
        return _entries.GetValueOrDefault((role, broadcasterId)) as IReadOnlyList<T>;
    }

    public void Set<T>(ChannelRole role, string broadcasterId, IReadOnlyList<T> users)
    {
        _entries[(role, broadcasterId)] = users;
    }

    public void Invalidate(ChannelRole role, string broadcasterId)
    {
        _entries.TryRemove((role, broadcasterId), out _);
    }
}
