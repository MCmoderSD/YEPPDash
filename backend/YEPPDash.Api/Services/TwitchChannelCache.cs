using System.Collections.Concurrent;
using YEPPDash.Api.Data;

namespace YEPPDash.Api.Services;

public enum ChannelRole
{
    Moderator,
    Vip
}

// Process-wide store for the fully paginated moderator/VIP lists. Deliberately not time-based:
// freshness is decided by re-reading the first page (see TwitchChannelService), and our own
// add/remove calls drop the affected entry outright.
public sealed class TwitchChannelCache
{
    private readonly ConcurrentDictionary<(ChannelRole Role, string BroadcasterId), IReadOnlyList<TwitchChannelUser>> entries = new();

    public IReadOnlyList<TwitchChannelUser>? Get(ChannelRole role, string broadcasterId)
    {
        return entries.TryGetValue((role, broadcasterId), out var cached) ? cached : null;
    }

    public void Set(ChannelRole role, string broadcasterId, IReadOnlyList<TwitchChannelUser> users)
    {
        entries[(role, broadcasterId)] = users;
    }

    public void Invalidate(ChannelRole role, string broadcasterId)
    {
        entries.TryRemove((role, broadcasterId), out _);
    }
}
