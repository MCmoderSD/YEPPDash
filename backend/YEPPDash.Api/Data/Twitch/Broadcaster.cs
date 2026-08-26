namespace YEPPDash.Api.Data.Twitch;

public sealed record Broadcaster : TwitchUser
{
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
                Verified: user.BroadcasterType.Equals("partner", StringComparison.OrdinalIgnoreCase))
        };
    }
}