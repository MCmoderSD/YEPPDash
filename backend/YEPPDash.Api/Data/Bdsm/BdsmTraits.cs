namespace YEPPDash.Api.Data.Bdsm;

// Column names, so spelled out rather than derived from the package's Kink enum: a kink added
// there would put a column into the query that the table does not have.
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
