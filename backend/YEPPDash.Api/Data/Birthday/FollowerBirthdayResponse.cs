using System.Globalization;
using YEPPDash.Api.Data.Twitch;

namespace YEPPDash.Api.Data.Birthday;

public sealed record FollowerBirthdayResponse(
    string UserId,
    int Day,
    int Month,
    int Year,
    TwitchUser? User
) {
    public static FollowerBirthdayResponse From(Birthday birthday, TwitchUser? user)
    {
        return new FollowerBirthdayResponse(
            birthday.UserId.ToString(CultureInfo.InvariantCulture),
            birthday.Day,
            birthday.Month,
            birthday.Year,
            user);
    }
}