namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchChannelUser
{
    public required string UserId { get; init; }

    public required string UserLogin { get; init; }

    public required string UserName { get; init; }
}