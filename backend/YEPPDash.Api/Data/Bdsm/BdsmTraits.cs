using MCmoderSD.BdsmTestApi.Enums;

namespace YEPPDash.Api.Data.Bdsm;

public static class BdsmTraits
{
    // Enum order is the order results are shown in, and it already matches the table's columns.
    public static readonly IReadOnlyList<Kink> All = KinkExtensions.All;

    // The BDSM table has one column per kink, named after it in lower camel case.
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
