namespace YEPPDash.Api.EventSub.Events;

public sealed record ChannelPointsRedemption
{
    public string Id { get; init; } = "";

    public string UserId { get; init; } = "";

    public string UserName { get; init; } = "";

    public string UserInput { get; init; } = "";

    public DateTimeOffset RedeemedAt { get; init; }

    public ChannelPointsRedemptionReward Reward { get; init; } = new();
}

public sealed record ChannelPointsRedemptionReward
{
    public string Id { get; init; } = "";
}