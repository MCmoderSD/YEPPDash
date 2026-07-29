namespace YEPPDash.Api.Data;

public sealed record BannedUserResponse(
    string Id,
    string Login,
    string DisplayName,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset CreatedAt,
    string? Reason,
    ChannelUserResponse Moderator)
{
    public static BannedUserResponse From(TwitchBannedUser user)
    {
        return new BannedUserResponse(
            user.UserId,
            user.UserLogin,
            user.UserName,
            user.ExpiresAt,
            user.CreatedAt,
            user.Reason,
            new ChannelUserResponse(user.ModeratorId, user.ModeratorLogin, user.ModeratorName));
    }
}
