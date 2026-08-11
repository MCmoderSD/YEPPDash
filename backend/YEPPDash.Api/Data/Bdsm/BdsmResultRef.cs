namespace YEPPDash.Api.Data.Bdsm;

// All the database still contributes: who took a test, and the id BDSMTest.org files it under.
// The scores themselves are fetched from there rather than read from the stored columns.
public sealed record BdsmResultRef(int UserId, string ResultId);
