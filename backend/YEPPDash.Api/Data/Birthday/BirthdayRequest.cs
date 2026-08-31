namespace YEPPDash.Api.Data.Birthday;

public sealed record BirthdayRequest
{
    public int Day { get; init; }
    public int Month { get; init; }
    public int Year { get; init; }

    public string? Problem(DateOnly today)
    {
        if (Month is < 1 or > 12) return "Month must be between 1 and 12.";

        if (Year < BirthdayLimits.MinYear || Year > today.Year)
        {
            return $"Year must be between {BirthdayLimits.MinYear} and {today.Year}.";
        }

        var length = DateTime.DaysInMonth(Year, Month);
        if (Day < 1 || Day > length) return $"Day must be between 1 and {length} for that month.";

        return new DateOnly(Year, Month, Day) > today ? "A birthday cannot be in the future." : null;
    }
}

public static class BirthdayLimits
{
    public const int MinYear = 1900;
}