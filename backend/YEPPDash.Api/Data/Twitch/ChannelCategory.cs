namespace YEPPDash.Api.Data.Twitch;

public sealed record ChannelCategory
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    // A template, not a URL: it carries {width} and {height} for the caller to substitute.
    public string BoxArtUrl { get; init; } = "";
}
