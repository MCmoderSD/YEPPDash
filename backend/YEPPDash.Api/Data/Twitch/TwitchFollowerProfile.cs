using System.Diagnostics.CodeAnalysis;

namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchFollowerProfile : TwitchUser
{
    [SetsRequiredMembers]
    public TwitchFollowerProfile(TwitchUser user, DateTimeOffset followedAt) : base(user)
    {
        FollowedAt = followedAt;
    }

    public DateTimeOffset FollowedAt { get; init; }
}

// Following stands on its own rather than on Follow: a follow whose account Get Users no longer
// resolves is still a follow.
public sealed record FollowStatusResponse(bool Following, TwitchFollowerProfile? Follow);
