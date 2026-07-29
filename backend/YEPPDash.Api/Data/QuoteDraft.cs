namespace YEPPDash.Api.Data;

/// <summary>
/// A quote on its way into the database: the text, plus the timestamp it should keep if it came
/// from an export. A null timestamp means "stamp it now".
/// </summary>
public sealed record QuoteDraft(string Text, DateTimeOffset? Timestamp);
