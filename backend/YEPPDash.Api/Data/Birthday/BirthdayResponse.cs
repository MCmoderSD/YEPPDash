using System.Globalization;

namespace YEPPDash.Api.Data.Birthday;

public sealed record BirthdayResponse(
    string UserId, 
    int Day, 
    int Month, 
    int Year
) {
    public static BirthdayResponse From(Birthday birthday)
    {
        return new BirthdayResponse(
            birthday.UserId.ToString(CultureInfo.InvariantCulture),
            birthday.Day,
            birthday.Month,
            birthday.Year);
    }
}