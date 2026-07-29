namespace YEPPDash.Api.Data;

public sealed record QuoteResponse(int Id, string Quote, DateTimeOffset Timestamp)
{
    public static QuoteResponse From(Quote quote)
    {
        return new QuoteResponse(quote.Id, quote.Text, quote.Timestamp);
    }
}
