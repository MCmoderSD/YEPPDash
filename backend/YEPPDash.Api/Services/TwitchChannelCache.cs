using System.Collections.Concurrent;
using YEPPDash.Api.Data;

namespace YEPPDash.Api.Services;

public enum ChannelRole
{
    Moderator,
    Vip
}

public sealed class TwitchChannelCache
{
    private readonly ConcurrentDictionary<(ChannelRole Role, string BroadcasterId), IReadOnlyList<TwitchChannelUser>> _entries = new();

    public IReadOnlyList<TwitchChannelUser>? Get(ChannelRole role, string broadcasterId)
    {
        return _entries.GetValueOrDefault((role, broadcasterId));
    }

    public void Set(ChannelRole role, string broadcasterId, IReadOnlyList<TwitchChannelUser> users)
    {
        _entries[(role, broadcasterId)] = users;
    }

    public void Invalidate(ChannelRole role, string broadcasterId)
    {
        _entries.TryRemove((role, broadcasterId), out _);
    }
}