using System.Globalization;

namespace YEPPDash.Api.Data.Bdsm;

public sealed record BdsmResultResponse(
    string Id,
    string UserId,
    DateTime Timestamp,
    int Version,
    string Gender,
    string AgeGroup,
    IReadOnlyDictionary<string, int> Traits
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
            // Whole percent on the wire, the way BDSMTest.org itself reports both traits and matches.
            result.Traits.ToDictionary(trait => trait.Key, trait => Percent(trait.Value), StringComparer.Ordinal));
    }

    private static int Percent(double score)
    {
        return (int) Math.Round(score * 100, MidpointRounding.AwayFromZero);
    }
}
