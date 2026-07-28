namespace YEPPDash.Api.Data;

// Trimmed down from Twitch's full chat-color payload (which also carries login/display
// name) — the dashboard only needs to know whose colour this is and what it is.
public sealed record ChatColorResponse(string Id, string? Color);