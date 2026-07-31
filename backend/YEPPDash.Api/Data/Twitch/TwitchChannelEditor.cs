namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchChannelEditor
{
    public required string UserId { get; init; }

    public required string UserName { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }
}
