using MCmoderSD.BdsmTestApi.Enums;

namespace YEPPDash.Api.Data.Bdsm;

public static class BdsmTraits
{
    public static readonly IReadOnlyList<Kink> All = KinkExtensions.All;

    public static string Column(Kink kink)
    {
        var name = kink.ToString();

        return string.Create(name.Length, name, (span, source) =>
        {
            source.CopyTo(span);
            span[0] = char.ToLowerInvariant(span[0]);
        });
    }
}