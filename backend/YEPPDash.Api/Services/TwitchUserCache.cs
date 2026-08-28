using System.Collections.Concurrent;
using YEPPDash.Api.Data.Twitch;

namespace YEPPDash.Api.Services;

public sealed class TwitchUserCache
{
    public static readonly TimeSpan TimeToLive = TimeSpan.FromMinutes(15);

    private readonly ConcurrentDictionary<(string BroadcasterId, string UserId), (TwitchUser User, DateTimeOffset StoredAt)> _entries = new();

    public TwitchUser? Get(string broadcasterId, string userId)
    {
        if (!_entries.TryGetValue((broadcasterId, userId), out var entry)) return null;

        if (DateTimeOffset.UtcNow - entry.StoredAt <= TimeToLive) return entry.User;

        _entries.TryRemove((broadcasterId, userId), out _);
        return null;
    }

    public void Set(string broadcasterId, TwitchUser user)
    {
        _entries[(broadcasterId, user.Id)] = (user, DateTimeOffset.UtcNow);
    }

    public void Invalidate(string broadcasterId, string userId)
    {
        _entries.TryRemove((broadcasterId, userId), out _);
    }

    // Get only drops an entry it was asked for, so a channel browsed once and left alone would keep
    // every profile it touched for as long as the process lives -- one look at the follower list of
    // a large channel is tens of thousands of them. This drops everything already past its life,
    // read or not.
    //
    // Removing by key and value rather than by key alone: an entry refreshed between the check and
    // the removal is no longer the one being swept, and throwing it away would cost the request
    // that just paid for it.
    public int Sweep()
    {
        var cutoff = DateTimeOffset.UtcNow - TimeToLive;
        var dropped = 0;

        foreach (var entry in _entries)
        {
            if (entry.Value.StoredAt > cutoff) continue;
            if (_entries.TryRemove(entry)) dropped++;
        }

        return dropped;
    }
}