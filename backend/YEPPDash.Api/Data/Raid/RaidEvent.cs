namespace YEPPDash.Api.Data.Raid;

public sealed record RaidEvent(
    Guid Id,
    int ChannelId,
    int RaiderId,
    int Viewers,
    DateTimeOffset FiredAt
);