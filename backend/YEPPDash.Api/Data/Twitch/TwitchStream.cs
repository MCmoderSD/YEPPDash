namespace YEPPDash.Api.Data.Twitch;

/// <summary>
/// A live stream as Helix reports it. Only the fields that answer "is this channel live right now"
/// are kept — the endpoint returns nothing at all for an offline channel, so the absence of a
/// stream is the answer rather than a field on one.
/// </summary>
public sealed record TwitchStream(
    string Id,
    string UserId,
    string UserLogin,
    string Type,
    string Title,
    DateTimeOffset StartedAt
);
