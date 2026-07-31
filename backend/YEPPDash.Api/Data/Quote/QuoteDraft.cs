namespace YEPPDash.Api.Data.Quote;

public sealed record QuoteDraft(
    string Text, 
    DateTimeOffset? Timestamp
);