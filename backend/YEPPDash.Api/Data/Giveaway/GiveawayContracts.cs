using YEPPDash.Api.Data.Twitch;

namespace YEPPDash.Api.Data.Giveaway;

public sealed record GiveawaySummary(
    Guid Id,
    string Title,
    string Description,
    GiveawayStatus Status,
    long Cost,
    DateTime UpdatedAt,
    int ParticipantCount,
    int WinnerCount,
    bool RewardMissing,
    CustomReward? Reward
);

public sealed record GiveawayParticipantResponse(
    string UserId,
    string UserName,
    string RedemptionId,
    bool IsFollower,
    SubscriptionTier SubTier,
    bool IsVip,
    bool IsModerator,
    double Multiplier,
    DateTime EnteredAt,
    TwitchUser? User
);

public sealed record GiveawayWinnerResponse(
    int DrawOrder,
    string UserId,
    string UserName,
    double Multiplier,
    DateTime WonAt,
    TwitchUser? User
);

public sealed record GiveawaySettings(
    Guid Id,
    GiveawayStatus Status,
    DateTime UpdatedAt,
    CustomReward? Reward,
    bool RewardMissing,
    string Title,
    string Description,
    long Cost,
    long? CooldownSeconds,
    long? MaxPerStream,
    long? MaxPerUserPerStream,
    GiveawayRequirements Requirements,
    GiveawayMultipliers Multipliers,
    IReadOnlyList<GiveawayParticipantResponse> Participants,
    IReadOnlyList<GiveawayWinnerResponse> Winners
);

public sealed record GiveawayUpdate
{
    public required string Title { get; init; }

    public required long Cost { get; init; }

    public string? Description { get; init; }

    public string? BackgroundColor { get; init; }

    public long? CooldownSeconds { get; init; }

    public long? MaxPerStream { get; init; }

    public long? MaxPerUserPerStream { get; init; }

    public GiveawayRequirements Requirements { get; init; } = GiveawayRequirements.None;

    public GiveawayMultipliers Multipliers { get; init; } = GiveawayMultipliers.Default;
}

public sealed record GiveawayOverlaySlice(string Label, double Weight);

public sealed record GiveawayOverlayState(
    Guid GiveawayId,
    string Title,
    IReadOnlyList<GiveawayOverlaySlice> Slices
);

public sealed record GiveawayOverlayResponse(GiveawayOverlayState? Giveaway);

public sealed record GiveawayDrawResponse(
    int Index,
    GiveawayWinnerResponse Winner,
    IReadOnlyList<GiveawayOverlaySlice> Slices
);