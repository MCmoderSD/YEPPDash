namespace YEPPDash.Api.Data.Twitch;

// The write form of a content classification label. Reading and writing them are not symmetrical:
// Get Channel Information answers with a plain array of the ids that are switched on, while Modify
// Channel Information takes id/enabled pairs, because turning one off has to be said out loud.
public sealed record ContentClassificationLabel
{
    public required string Id { get; init; }

    public bool IsEnabled { get; init; }
}

public static class ContentClassificationLabels
{
    // The six Twitch documents. Anything outside this set is rejected before the request goes out,
    // so a typo does not come back as an opaque 400 from Helix.
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
