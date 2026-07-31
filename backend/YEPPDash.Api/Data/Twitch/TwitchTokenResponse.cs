namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchTokenResponse
{
    public required string AccessToken { get; init; }

    public required string RefreshToken { get; init; }

    public int ExpiresIn { get; init; }

    public string[] Scope { get; init; } = [];

    public string? TokenType { get; init; }
}