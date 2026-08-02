using System.Text.Json.Serialization;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchBannedUser
{
    public required string UserId { get; init; }

    // Empty for a permanent ban — only a timeout ever has an expiry.
    [JsonConverter(typeof(EmptyStringToNullDateTimeOffsetConverter))]
    public DateTimeOffset? ExpiresAt { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    [JsonConverter(typeof(EmptyStringToNullConverter))]
    public string? Reason { get; init; }

    public required string ModeratorId { get; init; }
}