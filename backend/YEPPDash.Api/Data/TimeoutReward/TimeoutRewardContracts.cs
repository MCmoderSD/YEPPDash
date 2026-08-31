using YEPPDash.Api.Data.Twitch;

namespace YEPPDash.Api.Data.TimeoutReward;

public sealed record TimeoutRewardSettings(
    CustomReward Reward,
    int DurationSeconds,
    IReadOnlyList<ProtectedRole> Protected
);

public sealed record TimeoutRewardUpdate
{
    public required string Title { get; init; }

    public required long Cost { get; init; }

    public string? Prompt { get; init; }

    public string? BackgroundColor { get; init; }

    public bool? IsEnabled { get; init; }

    public long? CooldownSeconds { get; init; }

    public long? MaxPerStream { get; init; }

    public long? MaxPerUserPerStream { get; init; }

    public required int DurationSeconds { get; init; }

    public IReadOnlyList<ProtectedRole> Protected { get; init; } = [];
}