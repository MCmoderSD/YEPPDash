namespace YEPPDash.Api.Data.Bdsm;

public sealed record BdsmResult(
    string Id,
    int UserId,
    DateTime Timestamp,
    int Version,
    string Gender,
    string AgeGroup,
    IReadOnlyDictionary<string, double> Traits
);