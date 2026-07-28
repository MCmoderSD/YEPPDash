using System.Text.Json.Serialization;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Data;

public sealed record TwitchUser
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("login")]
    public required string Login { get; init; }

    [JsonPropertyName("display_name")]
    public required string DisplayName { get; init; }

    [JsonPropertyName("type")]
    public required string Type { get; init; }

    [JsonPropertyName("broadcaster_type")]
    public required string BroadcasterType { get; init; }

    [JsonPropertyName("description")]
    public required string Description { get; init; }

    [JsonPropertyName("profile_image_url")]
    public required string ProfileImageUrl { get; init; }

    [JsonPropertyName("offline_image_url")]
    [JsonConverter(typeof(EmptyStringToNullConverter))]
    public required string? OfflineImageUrl { get; init; }

    [JsonPropertyName("created_at")]
    public required DateTimeOffset CreatedAt { get; init; }

    [JsonPropertyName("email")]
    public string? Email { get; init; }
}
