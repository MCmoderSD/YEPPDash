namespace YEPPDash.Api.Helpers;

public static class LogSafe
{
    private const int Limit = 256;

    public static string OneLine(string? value)
    {
        if (value is null) return "<null>";
        if (value.Length is 0) return "<empty>";
        
        var flattened = value
            .Replace("\r\n", " ", StringComparison.Ordinal)
            .Replace("\r", " ", StringComparison.Ordinal)
            .Replace("\n", " ", StringComparison.Ordinal);

        var printable = new string(flattened.Select(character => char.IsControl(character) ? ' ' : character).ToArray());

        return printable.Length <= Limit ? printable : printable[..Limit] + "\u2026";
    }
}