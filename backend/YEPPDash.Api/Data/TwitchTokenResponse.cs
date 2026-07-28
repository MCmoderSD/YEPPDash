using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data;

public sealed record TwitchTokenResponse
{
    [JsonPropertyName("access_token")]
    public required string AccessToken { get; init; }

    [JsonPropertyName("refresh_token")]
    public required string RefreshToken { get; init; }

    [JsonPropertyName("expires_in")]
    public int ExpiresIn { get; init; }

    [JsonPropertyName("scope")]
    public string[] Scope { get; init; } = [];

    [JsonPropertyName("token_type")]
    public string? TokenType { get; init; }
}