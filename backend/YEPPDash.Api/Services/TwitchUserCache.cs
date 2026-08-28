using System.Collections.Concurrent;
using YEPPDash.Api.Data.Twitch;

namespace YEPPDash.Api.Services;

public sealed class TwitchUserCache
{
    private static readonly TimeSpan TimeToLive = TimeSpan.FromMinutes(15);

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
}