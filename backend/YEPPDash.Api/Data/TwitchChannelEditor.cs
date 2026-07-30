namespace YEPPDash.Api.Data;

// Get Channel Editors answers with no login and no pagination, so it does not fit the user triple
// that the moderator and VIP lists share.
public sealed record TwitchChannelEditor
{
    public required string UserId { get; init; }

    public required string UserName { get; init; }

    // When the broadcaster gave this user editor permissions.
    public required DateTimeOffset CreatedAt { get; init; }
}
