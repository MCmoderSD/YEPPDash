namespace YEPPDash.Api.Data.Twitch;

// Sent with a 403 when the caller's stored token predates a scope this app now asks for. A 403 on
// its own is ambiguous — Twitch answers with one too, and that one means something else — so the
// reason is named rather than left to be inferred from the status code.
public sealed record ScopeRequired(string Scope, string Message)
{
    public string Reason { get; init; } = "missing_scope";
}
