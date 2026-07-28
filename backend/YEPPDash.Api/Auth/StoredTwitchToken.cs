namespace YEPPDash.Api.Auth;

public sealed record StoredTwitchToken(
    string TwitchUserId,
    string AccessToken,
    string RefreshToken,
    string[] Scopes,
    DateTimeOffset ExpiresAt
);
