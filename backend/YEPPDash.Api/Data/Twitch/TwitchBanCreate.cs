using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchBanCreate
{
    public required string UserId { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public long? Duration { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Reason { get; init; }
}

public sealed record TwitchBanResult
{
    public required string UserId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? EndTime { get; init; }
}

public sealed record BanCreate(
    long? Duration, 
    string? Reason
);