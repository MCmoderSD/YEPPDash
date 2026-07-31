using System.Globalization;

namespace YEPPDash.Api.Data.Bdsm;

public sealed record BdsmResultResponse(
    string Id,
    string UserId,
    DateTime Timestamp,
    int Version,
    string Gender,
    string AgeGroup,
    IReadOnlyDictionary<string, double> Traits
) {
    public static BdsmResultResponse From(BdsmResult result)
    {
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