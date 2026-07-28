using System.Net;

namespace YEPPDash.Api.Twitch;

public sealed class TwitchOAuthException(string message, HttpStatusCode statusCode, string? responseBody = null)
    : Exception(message)
{
    public HttpStatusCode StatusCode { get; } = statusCode;
    public string? ResponseBody { get; } = responseBody;
}