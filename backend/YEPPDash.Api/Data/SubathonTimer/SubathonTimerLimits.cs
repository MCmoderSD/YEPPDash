namespace YEPPDash.Api.Data.SubathonTimer;

public static class SubathonTimerLimits
{
    // A year, and not a policy — a subathon that wants a real ceiling should say so itself. This is
    // only here so a mistyped `!timer set 99999999999` is refused instead of pushing the deadline
    // somewhere the arithmetic stops being meaningful.
    public const int MaxSeconds = 365 * 24 * 60 * 60;

    public const int MaxStyleLength = 2000;
}
