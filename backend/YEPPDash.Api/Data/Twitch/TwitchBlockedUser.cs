namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchBlockedUser
{
    public required string UserId { get; init; }

    public required string UserLogin { get; init; }

    public required string DisplayName { get; init; }

    public TwitchChannelUser ToChannelUser()
    {
        return new TwitchChannelUser
        {
            UserId = UserId,
            UserLogin = UserLogin,
            UserName = DisplayName
        };
    }
}