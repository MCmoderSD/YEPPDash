namespace YEPPDash.Api.Data.Twitch;

public sealed record BanStatusResponse(bool Banned, BannedUserResponse? Ban)
{
    public static BanStatusResponse From(TwitchBannedUser? user)
    {
        return user is null ? new BanStatusResponse(false, null) : new BanStatusResponse(true, BannedUserResponse.From(user));
    }
}