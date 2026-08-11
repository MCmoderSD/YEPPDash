using MCmoderSD.BdsmTestApi.Data;

namespace YEPPDash.Api.Data.Bdsm;

// A result as BDSMTest.org returns it, paired back up with the Twitch user it was stored for —
// the API itself only knows result ids, not who they belong to.
public sealed record BdsmUserResult(int UserId, TestResult Result);

public sealed record BdsmUserMatch(string UserId, string PartnerId, int Score, TestResult Result, TestResult Partner);

public sealed record BdsmPair(string UserId, string PartnerId);
