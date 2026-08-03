namespace YEPPDash.Api.Data.Wheel;

public static class WheelLimits
{
    public const int MaxEntryLength = 60;
    public const int MaxEntries = 200;
    public const char Separator = ',';
}

public sealed record Wheel(IReadOnlyList<string> Entries);