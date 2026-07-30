using System.Collections.Concurrent;

namespace YEPPDash.Api.Services;

public enum ChannelRole
{
    Moderator,
    Vip,
    Blocked,
    Follower
}

/// <summary>
/// The last fully walked list per role and channel.
/// </summary>
/// <remarks>
/// The element type is decided by the role — followers are <c>TwitchFollower</c>, every other role is
/// <c>TwitchChannelUser</c> — which is why the entries are held as <see cref="object"/> rather than
/// one closed list type. Asking a role for the wrong type reads as a miss instead of throwing, so a
/// mismatch can only ever cost a refetch.
/// </remarks>
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
