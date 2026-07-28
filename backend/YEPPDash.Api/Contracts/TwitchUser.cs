using System.Text.Json.Serialization;

namespace YEPPDash.Api.Contracts;

public sealed record TwitchUser
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("login")]
    public required string Login { get; init; }

    [JsonPropertyName("display_name")]
    public required string DisplayName { get; init; }

    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("profile_image_url")]
    public string? ProfileImageUrl { get; init; }
}
