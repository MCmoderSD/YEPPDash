using System.Text.Json.Serialization;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Data.Twitch;

// Unsealed so the enriched profiles can inherit it and pick up every field through the record copy
// constructor. Anything added here reaches the browser, so an internal-only field wants [JsonIgnore].
public record TwitchUser
{
    public required string Id { get; init; }

    public required string Login { get; init; }

    public required string DisplayName { get; init; }

    public required string Type { get; init; }

    public required string BroadcasterType { get; init; }

    public required string Description { get; init; }

    public required string ProfileImageUrl { get; init; }

    [JsonConverter(typeof(EmptyStringToNullConverter))]
    public required string? OfflineImageUrl { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    public string? Email { get; init; }

    // Not Helix fields: Get Users answers without them, so they stay null until the channel
    // service fills them in from Get User Chat Color and the channel's role lists.
    public string? Color { get; init; }

    public TwitchUserRoles? Roles { get; init; }
}
