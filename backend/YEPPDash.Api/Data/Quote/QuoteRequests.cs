using System.ComponentModel.DataAnnotations;

namespace YEPPDash.Api.Data.Quote;

public sealed record QuoteTextRequest
{
    [Required(AllowEmptyStrings = false)]
    [MaxLength(QuoteLimits.MaxLength)]
    public string Quote { get; init; } = "";
}

public sealed record QuotePositionRequest
{
    [Range(1, int.MaxValue)]
    public int Position { get; init; }
}

public static class QuoteLimits
{
    public const int MaxLength = 500;
}