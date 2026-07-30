namespace YEPPDash.Api.Data;

public sealed record FollowerResponse(string Id, string Login, string DisplayName, DateTimeOffset FollowedAt)
{
    public static FollowerResponse From(TwitchFollower follower)
    {
        return new FollowerResponse(
            follower.UserId, follower.UserLogin, follower.UserName, follower.FollowedAt);
    }
}

// "Does this user follow?" answers with 200 and a flag rather than 404, so the caller does not have
// to treat the perfectly normal "does not follow" case as a failed request.
public sealed record FollowStatusResponse(bool Following, FollowerResponse? Follow)
{
    public static FollowStatusResponse From(TwitchFollower? follower)
    {
        return follower is null
            ? new FollowStatusResponse(false, null)
            : new FollowStatusResponse(true, FollowerResponse.From(follower));
    }
}
