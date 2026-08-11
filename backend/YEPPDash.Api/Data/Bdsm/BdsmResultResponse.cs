using System.Globalization;
using MCmoderSD.BdsmTestApi.Data;
using MCmoderSD.BdsmTestApi.Enums;

namespace YEPPDash.Api.Data.Bdsm;

public sealed record BdsmResultResponse(
    string Id,
    string UserId,
    DateTime Timestamp,
    int Version,
    string Gender,
    string AgeGroup,
    string Language,
    IReadOnlyList<BdsmTraitResponse> Traits
) {
    public static BdsmResultResponse From(BdsmResult result, Language language)
    {
        return new BdsmResultResponse(
            result.Id,
            result.UserId.ToString(CultureInfo.InvariantCulture),
            result.Timestamp,
            result.Version,
            result.Gender,
            result.AgeGroup,
            language.GetCode(),
            [.. BdsmTraits.All.Select(kink => BdsmTraitResponse.From(kink, result.Traits.GetValueOrDefault(kink), language))]);
    }
}

// The package also carries a description and a pairing description per kink; neither is shown,
// and at 25 of them per result they are not worth the payload until something renders them.
public sealed record BdsmTraitResponse(string Kink, string Name, int Percent)
{
    public static BdsmTraitResponse From(Kink kink, double score, Language language)
    {
        return new BdsmTraitResponse(
            BdsmTraits.Column(kink),
            Documentation.Get(kink, language).Name,
            // Whole percent on the wire, the way BDSMTest.org itself reports both traits and matches.
            (int) Math.Round(score * 100, MidpointRounding.AwayFromZero));
    }
}
