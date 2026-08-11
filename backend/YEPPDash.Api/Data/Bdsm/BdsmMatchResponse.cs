namespace YEPPDash.Api.Data.Bdsm;

public sealed record BdsmMatchResponse(
    string UserId,
    string PartnerId,
    int Score,
    BdsmResultResponse Result,
    BdsmResultResponse Partner
) {
    public static BdsmMatchResponse From(BdsmUserMatch match)
    {
        return new BdsmMatchResponse(
            match.UserId,
            match.PartnerId,
            match.Score,
            BdsmResultResponse.From(match.UserId, match.Result),
            BdsmResultResponse.From(match.PartnerId, match.Partner));
    }
}
