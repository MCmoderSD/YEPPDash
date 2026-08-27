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

public sealed record FollowStatusResponse(bool Following, TwitchFollowerProfile? Follow);