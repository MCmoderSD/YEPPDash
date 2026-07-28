namespace YEPPDash.Api.Data;

// Same trimming as ChatColorResponse: Twitch's user_id/user_login/user_name renamed to the
// id/login/displayName the frontend already uses everywhere else for a Twitch user.
public sealed record ChannelUserResponse(string Id, string Login, string DisplayName)
{
    public static ChannelUserResponse From(TwitchChannelUser user)
    {
        return new ChannelUserResponse(user.UserId, user.UserLogin, user.UserName);
    }
}
