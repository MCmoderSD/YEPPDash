using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data.Twitch;

public sealed record CustomReward
{
    public required string Id { get; init; }
    public string BroadcasterId { get; init; } = "";
    public string Title { get; init; } = "";
    public string Prompt { get; init; } = "";
    public long Cost { get; init; }
    public CustomRewardImage? Image { get; init; }
    public CustomRewardImage? DefaultImage { get; init; }
    public string BackgroundColor { get; init; } = "";
    public bool IsEnabled { get; init; }
    public bool IsUserInputRequired { get; init; }
    public CustomRewardMaxPerStream MaxPerStreamSetting { get; init; } = new();
    public CustomRewardMaxPerUserPerStream MaxPerUserPerStreamSetting { get; init; } = new();
    public CustomRewardGlobalCooldown GlobalCooldownSetting { get; init; } = new();
    public bool IsPaused { get; init; }
    public bool IsInStock { get; init; }
    public bool ShouldRedemptionsSkipRequestQueue { get; init; }
    public int? RedemptionsRedeemedCurrentStream { get; init; }
    public DateTimeOffset? CooldownExpiresAt { get; init; }
    public bool IsManageable { get; init; }
}

public sealed record CustomRewardImage
{
    [JsonPropertyName("url_1x")]
    public string Url1X { get; init; } = "";

    [JsonPropertyName("url_2x")]
    public string Url2X { get; init; } = "";

    [JsonPropertyName("url_4x")]
    public string Url4X { get; init; } = "";
}

public sealed record CustomRewardMaxPerStream
{
    public bool IsEnabled { get; init; }
    public long MaxPerStream { get; init; }
}

public sealed record CustomRewardMaxPerUserPerStream
{
    public bool IsEnabled { get; init; }
    public long MaxPerUserPerStream { get; init; }
}

public sealed record CustomRewardGlobalCooldown
{
    public bool IsEnabled { get; init; }
    public long GlobalCooldownSeconds { get; init; }
}