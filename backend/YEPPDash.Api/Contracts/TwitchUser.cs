using System.Text.Json.Serialization;

namespace YEPPDash.Api.Contracts;

// One entry of the "data" array returned by GET https://api.twitch.tv/helix/users.
// "email" is only populated when the access token carries the user:read:email scope.
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
