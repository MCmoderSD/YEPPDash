using MCmoderSD.BdsmTestApi.Enums;

namespace YEPPDash.Api.Data.Bdsm;

public sealed record BdsmMatchResponse(
    string UserId,
    string PartnerId,
    int Score,
    BdsmResultResponse Result,
    BdsmResultResponse Partner
) {
    public static BdsmMatchResponse From(BdsmUserMatch match, Language language)
    {
        return new BdsmMatchResponse(
            match.UserId,
            match.PartnerId,
            match.Score,
            BdsmResultResponse.From(match.Result, language),
            BdsmResultResponse.From(match.Partner, language));
    }
}