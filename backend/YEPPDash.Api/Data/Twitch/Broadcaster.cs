namespace YEPPDash.Api.Data.Twitch;

// The signed-in user, and by construction the broadcaster: every channel this dashboard acts on is
// the caller's own, so there is no session in which they are anything else.
//
// Inherits Color and Roles rather than redeclaring them as non-nullable. Hiding them with `new`
// would read better here, but a hidden property only wins while the object is serialized as this
// type — handed anywhere as its base, the empty inherited one is written instead and the colour
// silently becomes null. The factory below is what guarantees both are set.
public sealed record Broadcaster : TwitchUser
{
    // Their own channel, so moderator, VIP and editor cannot apply: Twitch does not let a
    // broadcaster hold any of the three in it. Verified is the partner flag Get Users already
    // answered with. None of the four costs a request.
    public static Broadcaster From(TwitchUser user, string? color)
    {
        return new Broadcaster
        {
            Id = user.Id,
            Login = user.Login,
            DisplayName = user.DisplayName,
            Type = user.Type,
            BroadcasterType = user.BroadcasterType,
            Description = user.Description,
            ProfileImageUrl = user.ProfileImageUrl,
            OfflineImageUrl = user.OfflineImageUrl,
            CreatedAt = user.CreatedAt,
            Email = user.Email,
            Color = color,
            Roles = new TwitchUserRoles(
                Broadcaster: true,
                Moderator: false,
                Vip: false,
                Editor: false,
                Verified: user.BroadcasterType.Equals("partner", StringComparison.OrdinalIgnoreCase)),
        };
    }
}
