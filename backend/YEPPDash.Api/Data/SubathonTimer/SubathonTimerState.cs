namespace YEPPDash.Api.Data.SubathonTimer;

/// <summary>
/// A countdown is never stored as a number that decreases. What is kept is what the clock is set to,
/// not what it currently reads: <see cref="Running"/> says which of the next two carries the truth.
/// While it runs, <see cref="EndsAt"/> is the instant it reaches zero and <see cref="Remaining"/> is
/// meaningless; while it is paused it is the other way round. Reading the wrong one is always a bug.
/// </summary>
public sealed record SubathonTimerState(
    int ChannelId,
    bool Running,
    DateTime? EndsAt,
    int Remaining,
    int StartSeconds,
    string Style,
    DateTime UpdatedAt);
