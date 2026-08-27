namespace YEPPDash.Api.Data.Twitch;

public sealed record ChannelCategory
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public string BoxArtUrl { get; init; } = "";
}