namespace YEPPDash.Api.Data;

/// <summary>
/// The trait columns of YEPPBot's BDSM table, in the order a result reports them.
/// </summary>
/// <remarks>
/// The single place the trait set is written down. The repository builds its column list from this,
/// and every result carries its scores keyed by these names, so a trait that a later test version
/// adds is declared once rather than in a SQL projection, a row class and a mapper.
/// </remarks>
public static class BdsmTraits
{
    public static readonly IReadOnlyList<string> All =
    [
        "ageplayer",
        "brat",
        "bratTamer",
        "daddyMommy",
        "degrader",
        "dominant",
        "degradee",
        "little",
        "masochist",
        "masterMistress",
        "nonMonogamist",
        "owner",
        "primalHunter",
        "pet",
        "primalPrey",
        "rigger",
        "ropeBunny",
        "sadist",
        "slave",
        "submissive",
        "switch",
        "vanilla",
        "voyeur",
        "exhibitionist",
        "experimentalist"
    ];
}
