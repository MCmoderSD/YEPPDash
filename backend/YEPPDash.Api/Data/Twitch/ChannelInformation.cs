namespace YEPPDash.Api.Data.Twitch;

public sealed record ChannelInformation
{
    public required string BroadcasterId { get; init; }
    public required string BroadcasterLogin { get; init; }
    public required string BroadcasterName { get; init; }
    public string BroadcasterLanguage { get; init; } = "";
    public string GameId { get; init; } = "";
    public string GameName { get; init; } = "";
    public string Title { get; init; } = "";
    public int Delay { get; init; }
    public IReadOnlyList<string> Tags { get; init; } = [];
    public IReadOnlyList<string> ContentClassificationLabels { get; init; } = [];
    public bool IsBrandedContent { get; init; }
}