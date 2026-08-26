namespace YEPPDash.Api.Data.Twitch;

// What Get Channel Information answers with. The dashboard only edits the title and the game, but
// the rest is carried through rather than dropped: it costs nothing on a request that was made
// anyway, and a caller that wants the language or the tags should not need a second endpoint.
public sealed record ChannelInformation
{
    public required string BroadcasterId { get; init; }

    public required string BroadcasterLogin { get; init; }

    public required string BroadcasterName { get; init; }

    public string BroadcasterLanguage { get; init; } = "";

    // Empty when no category is set. Twitch returns "" rather than omitting the field.
    public string GameId { get; init; } = "";

    public string GameName { get; init; } = "";

    public string Title { get; init; } = "";

    public int Delay { get; init; }

    public IReadOnlyList<string> Tags { get; init; } = [];

    // Read as a plain list of the ids that are on. Writing them takes id/enabled pairs instead —
    // see ContentClassificationLabel.
    public IReadOnlyList<string> ContentClassificationLabels { get; init; } = [];

    public bool IsBrandedContent { get; init; }
}
