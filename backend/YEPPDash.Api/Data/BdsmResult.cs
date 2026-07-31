namespace YEPPDash.Api.Data;

/// <summary>
/// One completed BDSM test as stored in YEPPBot's database.
/// </summary>
/// <remarks>
/// <para>
/// Unlike a birthday, this is not one row per user: the primary key is the test's own id, so a user
/// who takes the test again keeps the older results alongside the new one. That is what
/// <paramref name="Timestamp"/> and <paramref name="Version"/> are for.
/// </para>
/// <para>
/// <paramref name="Traits"/> is keyed by <see cref="BdsmTraits.All"/> and every score is a fraction
/// between 0 and 1, which is how the table stores them — turning those into percentages is the
/// frontend's business. The table's raw <c>data</c> blob is deliberately not carried here; nothing
/// in the dashboard reads it, and it would be the largest column by far.
/// </para>
/// </remarks>
public sealed record BdsmResult(
    string Id,
    int UserId,
    DateTime Timestamp,
    int Version,
    string Gender,
    string AgeGroup,
    IReadOnlyDictionary<string, double> Traits);
