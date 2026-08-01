namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchUserRoles(
    bool Broadcaster,
    bool Moderator,
    bool Vip,
    bool Editor,
    bool Verified);
