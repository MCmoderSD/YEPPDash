namespace YEPPDash.Api.Data.Redemption;

public static class RedemptionOutcome
{
    public const string Claimed = "claimed";
    public const string Timeout = "timeout";
    public const string Refunded = "refunded";
}

public sealed record RedemptionRecord(
    string EventId,
    int ChannelId,
    string RewardId,
    string UserId,
    string Input,
    DateTime RedeemedAt,
    string Outcome = RedemptionOutcome.Claimed,
    string Reason = ""
);