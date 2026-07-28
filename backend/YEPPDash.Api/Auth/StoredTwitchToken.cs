namespace YEPPDash.Api.Auth;

// One user's Twitch credentials as YEPPDash keeps them. The access token is stored alongside the
// refresh token so a backend restart does not force a refresh round-trip for every active session.
public sealed record StoredTwitchToken(
    string TwitchUserId,
    string AccessToken,
    string RefreshToken,
    string[] Scopes,
    DateTimeOffset ExpiresAt
);
