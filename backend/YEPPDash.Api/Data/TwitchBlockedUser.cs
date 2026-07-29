namespace YEPPDash.Api.Data;

// Get User Block List is the odd one out among the channel-user endpoints: it calls the display
// name "display_name" where Get Moderators and Get VIPs call it "user_name". Everything else about
// it matches, so it gets its own shape purely to deserialize and is folded back into
// TwitchChannelUser straight away.
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
