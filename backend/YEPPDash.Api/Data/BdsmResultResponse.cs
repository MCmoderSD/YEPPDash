using System.Globalization;

namespace YEPPDash.Api.Data;

public sealed record BdsmResultResponse(
    string Id,
    string UserId,
    DateTime Timestamp,
    int Version,
    string Gender,
    string AgeGroup,
    IReadOnlyDictionary<string, double> Traits)
{
    public static BdsmResultResponse From(BdsmResult result)
    {
        // The id goes out as a string because that is how every other endpoint here represents a
        // Twitch user id, even though the column behind it is an INT.
        return new BdsmResultResponse(
            result.Id,
            result.UserId.ToString(CultureInfo.InvariantCulture),
            result.Timestamp,
            result.Version,
            result.Gender,
            result.AgeGroup,
            result.Traits);
    }
}
