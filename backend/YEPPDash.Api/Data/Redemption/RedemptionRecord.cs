namespace YEPPDash.Api.Data.Redemption;

public static class RedemptionStatus
{
    public const string Unfulfilled = "UNFULFILLED";
    public const string Fulfilled = "FULFILLED";
    public const string Canceled = "CANCELED";
}

public sealed record RedemptionRecord(
    string EventId,
    int ChannelId,
    string RewardId,
    string UserId,
    string Input,
    DateTime RedeemedAt,
    string Status = RedemptionStatus.Unfulfilled,
    string Reason = ""
);