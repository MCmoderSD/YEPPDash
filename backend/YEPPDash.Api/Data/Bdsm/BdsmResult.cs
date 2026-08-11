using MCmoderSD.BdsmTestApi.Enums;

namespace YEPPDash.Api.Data.Bdsm;

public sealed record BdsmResult(
    string Id,
    int UserId,
    DateTime Timestamp,
    int Version,
    string Gender,
    string AgeGroup,
    IReadOnlyDictionary<Kink, double> Traits
);

public sealed record BdsmCachedMatch(string ResultId, string PartnerId, double Score);