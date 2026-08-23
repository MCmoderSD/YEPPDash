namespace YEPPDash.Api.Data.SubathonTimer;

// Shared by adjust and set: one carries a signed delta, the other an absolute value, and neither
// needs a shape of its own to say so.
public sealed record SubathonTimerSecondsRequest
{
    public int Seconds { get; init; }
}

public sealed record SubathonTimerConfigRequest
{
    public int StartSeconds { get; init; }
}

public sealed record SubathonTimerStyleRequest
{
    public string Style { get; init; } = string.Empty;
}
