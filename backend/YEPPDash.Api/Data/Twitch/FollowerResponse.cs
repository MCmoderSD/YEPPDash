namespace YEPPDash.Api.Data.Twitch;

public sealed record FollowerResponse(string Id, string Login, string DisplayName, DateTimeOffset FollowedAt)
{
    public static FollowerResponse From(TwitchFollower follower)
    {
        return new FollowerResponse(follower.UserId, follower.UserLogin, follower.UserName, follower.FollowedAt);
    }
}

public sealed record FollowStatusResponse(bool Following, FollowerResponse? Follow)
{
    public static FollowStatusResponse From(TwitchFollower? follower)
    {
        return follower is null
            ? new FollowStatusResponse(false, null)
            : new FollowStatusResponse(true, FollowerResponse.From(follower));
    }
}