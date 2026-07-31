namespace YEPPDash.Api.Data.Quote;

public sealed record Quote(
    int Id, 
    string Text, 
    DateTimeOffset Timestamp
);