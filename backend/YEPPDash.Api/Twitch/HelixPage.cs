namespace YEPPDash.Api.Twitch;

public sealed record HelixPage<T>(IReadOnlyList<T> Items, string? Cursor);