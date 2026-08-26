namespace YEPPDash.Api.Data.Twitch;

public sealed record ContentClassificationLabel
{
    public required string Id { get; init; }
    public bool IsEnabled { get; init; }
}

public static class ContentClassificationLabels
{
    public static readonly IReadOnlySet<string> Known = new HashSet<string>(StringComparer.Ordinal)
    {
        "DebatedSocialIssuesAndPolitics",
        "DrugsIntoxication",
        "SexualThemes",
        "ViolentGraphic",
        "Gambling",
        "ProfanityVulgarity",
    };
}