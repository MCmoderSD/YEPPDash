namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchFollowerProfile(TwitchUser User, DateTimeOffset FollowedAt);
