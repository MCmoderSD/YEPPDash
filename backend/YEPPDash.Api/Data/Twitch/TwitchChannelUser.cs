namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchChannelUser
{
    public required string UserId { get; init; }
}