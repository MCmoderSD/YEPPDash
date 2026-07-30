namespace YEPPDash.Api.Data;

// The same user triple the moderator and VIP lists carry, plus when the follow started.
public sealed record TwitchFollower
{
    public required string UserId { get; init; }

    public required string UserLogin { get; init; }

    public required string UserName { get; init; }

    public required DateTimeOffset FollowedAt { get; init; }
}
