namespace YEPPDash.Api.Contracts;

// Response shape of GET /api/auth/me. Only TwitchId is stable — everything else is re-read from
// Twitch on each call, because logins, display names, avatars and e-mails can change at any time.
public sealed record UserInfo(
    string TwitchId,
    string Login,
    string DisplayName,
    string? Email,
    string? ProfileImageUrl
);
