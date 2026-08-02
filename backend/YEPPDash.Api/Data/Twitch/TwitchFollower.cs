namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchFollower
{
    public required string UserId { get; init; }

    public required DateTimeOffset FollowedAt { get; init; }
}