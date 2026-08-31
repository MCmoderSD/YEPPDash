namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchStream
{
    public int ViewerCount { get; init; }
    public DateTimeOffset StartedAt { get; init; }
    public string ThumbnailUrl { get; init; } = "";
}

public sealed record StreamStatusResponse(
    bool Live, 
    TwitchStream? Stream
);