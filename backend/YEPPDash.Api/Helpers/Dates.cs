namespace YEPPDash.Api.Helpers;

public static class Dates
{
    public static DateTime AsUtc(this DateTime stored)
    {
        return DateTime.SpecifyKind(stored, DateTimeKind.Utc);
    }
}