using System.Net;

namespace YEPPDash.Api.Twitch;

// Raised whenever id.twitch.tv or api.twitch.tv answers with a non-success status. StatusCode is
// carried along so callers can distinguish "this token is dead" (401) from "Twitch is having a
// bad day" (5xx) — the two need very different handling.
public sealed class TwitchOAuthException(string message, HttpStatusCode statusCode, string? responseBody = null)
    : Exception(message)
{
    public HttpStatusCode StatusCode { get; } = statusCode;
    public string? ResponseBody { get; } = responseBody;
}
