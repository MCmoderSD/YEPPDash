namespace YEPPDash.Api.Data.SubathonTimer;

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