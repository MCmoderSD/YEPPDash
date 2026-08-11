namespace YEPPDash.Api.Data.Bdsm;

// All the database still contributes: who took a test, and the id BDSMTest.org files it under.
// The scores themselves are fetched from there rather than read from the stored columns.
public sealed record BdsmResultRef(int UserId, string ResultId);

// A match YEPPBot has already paid for. Its `data` column is YEPPBot's own payload in a format
// this side does not share, so only the score is read — the two results behind it are fetched
// like any other. Note the fraction: MatchCache stores 0..1 where BDSMTest.org reports percent.
public sealed record BdsmCachedMatch(string ResultId, string PartnerId, double Score);
