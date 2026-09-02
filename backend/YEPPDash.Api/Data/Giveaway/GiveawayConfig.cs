using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data.Giveaway;

[JsonConverter(typeof(JsonStringEnumConverter<GiveawayStatus>))]
public enum GiveawayStatus
{
    Draft,
    Open,
    Closed
}

[JsonConverter(typeof(JsonStringEnumConverter<RequirementState>))]
public enum RequirementState
{
    Ignored,
    Required,
    Excluded
}

[JsonConverter(typeof(JsonStringEnumConverter<SubscriptionTier>))]
public enum SubscriptionTier
{
    None,
    Tier1,
    Tier2,
    Tier3
}

public sealed record GiveawayRequirements(
    RequirementState Follower,
    RequirementState Subscriber,
    RequirementState Tier2,
    RequirementState Tier3,
    RequirementState Vip,
    RequirementState Moderator
)
{
    public static readonly GiveawayRequirements None = new(
        RequirementState.Ignored,
        RequirementState.Ignored,
        RequirementState.Ignored,
        RequirementState.Ignored,
        RequirementState.Ignored,
        RequirementState.Ignored);
}

public sealed record GiveawayMultipliers(
    double Base,
    double Follower,
    double Subscriber,
    double Tier2,
    double Tier3,
    double Vip,
    double Moderator
)
{
    public static readonly GiveawayMultipliers Default = new(1, 1, 1, 1, 1, 1, 1);
}

public sealed record GiveawayConfig(
    Guid Id,
    int ChannelId,
    string RewardId,
    string Title,
    string Description,
    long Cost,
    GiveawayStatus Status,
    DateTime UpdatedAt,
    long? CooldownSeconds,
    long? MaxPerStream,
    long? MaxPerUserPerStream,
    GiveawayRequirements Requirements,
    GiveawayMultipliers Multipliers
);

public sealed record GiveawayParticipantRecord(
    Guid GiveawayId,
    string UserId,
    string UserName,
    string RedemptionId,
    bool IsFollower,
    SubscriptionTier SubTier,
    bool IsVip,
    bool IsModerator,
    double Multiplier,
    DateTime EnteredAt
);

public sealed record GiveawayWinnerRecord(
    Guid GiveawayId,
    int DrawOrder,
    string UserId,
    string UserName,
    double Multiplier,
    DateTime WonAt
);

public static class SubscriptionTiers
{
    public static SubscriptionTier FromTwitch(string? tier)
    {
        return tier switch
        {
            "1000" => SubscriptionTier.Tier1,
            "2000" => SubscriptionTier.Tier2,
            "3000" => SubscriptionTier.Tier3,
            _ => SubscriptionTier.None,
        };
    }
}