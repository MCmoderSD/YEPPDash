namespace YEPPDash.Api.Data;

// Read with TwitchJson.Options, which maps Twitch's snake_case onto these names.
public sealed record TwitchTokenResponse
{
    public required string AccessToken { get; init; }

    public required string RefreshToken { get; init; }

    public int ExpiresIn { get; init; }

    public string[] Scope { get; init; } = [];

    public string? TokenType { get; init; }
}
