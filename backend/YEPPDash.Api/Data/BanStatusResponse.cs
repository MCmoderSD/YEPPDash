namespace YEPPDash.Api.Data;

// "Is this user banned?" answers with 200 and a flag rather than 404, so the caller does not have
// to treat the perfectly normal "not banned" case as a failed request.
public sealed record BanStatusResponse(bool Banned, BannedUserResponse? Ban)
{
    public static BanStatusResponse From(TwitchBannedUser? user)
    {
        return user is null ? new BanStatusResponse(false, null) : new BanStatusResponse(true, BannedUserResponse.From(user));
    }
}
