namespace YEPPDash.Api.Twitch;

// One page of a paginated Helix response. A null cursor means Twitch has nothing more to give.
public sealed record HelixPage<T>(IReadOnlyList<T> Items, string? Cursor);
