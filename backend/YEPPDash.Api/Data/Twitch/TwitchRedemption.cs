namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchRedemption
{
    public required string Id { get; init; }

    public required string UserId { get; init; }

    public string UserName { get; init; } = "";

    public string UserInput { get; init; } = "";

    public DateTimeOffset RedeemedAt { get; init; }
}

public sealed record TwitchSubscription
{
    public string Tier { get; init; } = "";
}