namespace YEPPDash.Api.Twitch;

// Resolved once at startup from Twitch:ClientId{DbTarget} / Twitch:ClientSecret{DbTarget} /
// Twitch:RedirectUri. RedirectUri must match a URI registered in the Twitch developer console
// byte for byte — Twitch compares it as an exact string, not as a parsed URL.
public sealed class TwitchAuthOptions
{
    public required string ClientId { get; init; }
    public required string ClientSecret { get; init; }
    public required string RedirectUri { get; init; }
    public string[] Scopes { get; init; } = TwitchScopes.Required;
}
