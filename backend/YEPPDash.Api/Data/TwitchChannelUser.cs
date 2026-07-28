namespace YEPPDash.Api.Data;

// Get Moderators and Get VIPs answer with the exact same three fields, so one record covers both.
public sealed record TwitchChannelUser
{
    public required string UserId { get; init; }

    public required string UserLogin { get; init; }

    public required string UserName { get; init; }
}
