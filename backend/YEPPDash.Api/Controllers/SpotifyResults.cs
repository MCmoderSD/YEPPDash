using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Spotify;
using YEPPDash.Api.Exceptions.Spotify;

namespace YEPPDash.Api.Controllers;

/// <summary>
/// One translation from the Spotify domain failures to HTTP, shared by the dashboard's controller
/// and the bot's. Both callers need the same distinction — "the request was understood and refused"
/// versus "the server cannot do Spotify at all" — and neither should be inventing status codes.
/// </summary>
public static class SpotifyResults
{
    public static IActionResult From(SpotifyException exception)
    {
        return exception switch
        {
            // Nothing the caller did, and nothing they can fix. A deployment without Spotify
            // credentials is a deployment where this feature does not exist.
            SpotifyNotConfiguredException => new ObjectResult(new SongRequestRejectionResponse(exception.Reason, null))
            {
                StatusCode = StatusCodes.Status503ServiceUnavailable
            },

            SpotifyRateLimitedException limited => new ObjectResult(
                new SongRequestRejectionResponse(exception.Reason, (int)Math.Ceiling(limited.RetryAfter.TotalSeconds)))
            {
                StatusCode = StatusCodes.Status429TooManyRequests
            },

            SongRequestRejectedException rejected => new ConflictObjectResult(
                new SongRequestRejectionResponse(exception.Reason, rejected.RetryAfterSeconds)),

            // 409 rather than 4xx-per-case on purpose: from the caller's side these are all the same
            // shape of answer — understood, refused, here is why in a word.
            _ => new ConflictObjectResult(new SongRequestRejectionResponse(exception.Reason, null))
        };
    }
}
