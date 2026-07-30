using System.Globalization;

namespace YEPPDash.Api.Data;

public sealed record BirthdayResponse(string UserId, int Day, int Month, int Year)
{
    public static BirthdayResponse From(Birthday birthday)
    {
        // The id goes out as a string because that is how every other endpoint here represents a
        // Twitch user id, even though the column behind it is an INT.
        return new BirthdayResponse(
            birthday.UserId.ToString(CultureInfo.InvariantCulture),
            birthday.Day,
            birthday.Month,
            birthday.Year);
    }
}
