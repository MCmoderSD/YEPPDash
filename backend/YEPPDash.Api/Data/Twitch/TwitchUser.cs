using System.Text.Json.Serialization;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Data.Twitch;

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
