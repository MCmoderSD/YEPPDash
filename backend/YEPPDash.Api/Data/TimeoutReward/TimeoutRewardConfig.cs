using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data.TimeoutReward;

[JsonConverter(typeof(JsonStringEnumConverter<ProtectedRole>))]
public enum ProtectedRole
{
    Follower,
    Subscriber,
    Tier2Subscriber,
    Tier3Subscriber,
    Vip,
    Editor,
    Moderator
}

public sealed record TimeoutRewardConfig(
    int ChannelId,
    string RewardId,
    string Title,
    string Description,
    long Cost,
    int DurationSeconds,
    long? CooldownSeconds,
    long? MaxPerStream,
    long? MaxPerUserPerStream,
    IReadOnlySet<ProtectedRole> Protected
);

public enum RestorableRole
{
    Moderator,
    Vip
}

public sealed record RoleRestore(
    int ChannelId,
    string UserId,
    RestorableRole Role,
    DateTime RestoreAt,
    int Attempts = 0
);