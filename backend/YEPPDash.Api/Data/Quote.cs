namespace YEPPDash.Api.Data;

/// <summary>
/// A single quote as stored in YEPPBot's database. <paramref name="Id"/> is the per-channel
/// position, numbered from 1 — it is not globally unique.
/// </summary>
public sealed record Quote(int Id, string Text, DateTimeOffset Timestamp);
