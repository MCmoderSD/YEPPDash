namespace YEPPDash.Api.Data.SubathonTimer;

public sealed record SubathonTimerState(
    int ChannelId,
    bool Running,
    DateTime? EndsAt,
    int Remaining,
    int StartSeconds,
    string Style,
    DateTime UpdatedAt
);