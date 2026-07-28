namespace YEPPDash.Api.Twitch;

public sealed class TwitchAuthOptions
{
    public required string ClientId { get; init; }
    public required string ClientSecret { get; init; }
    public required string RedirectUri { get; init; }
    public required string[] Scopes { get; init; }
}