using System.Text.Json.Serialization;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Data;

// Field names are mapped by TwitchJson.Options when reading Twitch's snake_case, and by ASP.NET's
// camelCase web defaults when writing this back to the frontend — see TwitchJson for why there are
// no [JsonPropertyName] attributes here.
public sealed record TwitchUser
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
}
