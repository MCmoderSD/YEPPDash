namespace YEPPDash.Api.Data.Bdsm;

public sealed record BdsmUserMatch(string UserId, string PartnerId, int Score, BdsmResult Result, BdsmResult Partner);
public sealed record BdsmMatchScore(string UserId, string PartnerId, int Score);
public sealed record BdsmPair(string UserId, string PartnerId);