namespace YEPPDash.Api.Data;

public sealed record BirthdayRequest
{
    public int Day { get; init; }
    public int Month { get; init; }
    public int Year { get; init; }

    /// <summary>
    /// Checks the three numbers against each other and against the calendar.
    /// </summary>
    /// <param name="today">The current date, passed in so this stays free of a hidden clock.</param>
    /// <returns>Why this is not a date of birth, or <c>null</c> when it is one.</returns>
    public string? Problem(DateOnly today)
    {
        // Month and year come first because the day check below needs both of them to be sane
        // before it can ask how long the month is.
        if (Month is < 1 or > 12) return "Month must be between 1 and 12.";

        if (Year < BirthdayLimits.MinYear || Year > today.Year)
        {
            return $"Year must be between {BirthdayLimits.MinYear} and {today.Year}.";
        }

        // The table only caps the day at 31, so this is the one rule it cannot express: without it
        // the 30th of February would be stored happily. Asking for the specific year also gets the
        // 29th of February right, which is a real birthday in a leap year and not in any other.
        var length = DateTime.DaysInMonth(Year, Month);
        if (Day < 1 || Day > length) return $"Day must be between 1 and {length} for that month.";

        if (new DateOnly(Year, Month, Day) > today) return "A birthday cannot be in the future.";

        return null;
    }
}

public static class BirthdayLimits
{
    /// <summary>Mirrors the lower bound of the CHECK constraint on the Birthday table.</summary>
    public const int MinYear = 1900;
}
