namespace YEPPDash.Api.Data.Twitch;

public sealed record ChannelUserResponse(string Id, string Login, string DisplayName)
{
    public static ChannelUserResponse From(TwitchChannelUser user)
    {
        return new ChannelUserResponse(user.UserId, user.UserLogin, user.UserName);
    }
}