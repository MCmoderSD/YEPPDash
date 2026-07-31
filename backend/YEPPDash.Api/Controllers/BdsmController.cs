using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Bdsm;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

/// <summary>
/// BDSM test results out of YEPPBot's BDSM table, read-only — the bot writes them when a user submits
/// a test.
/// </summary>
/// <remarks>
/// <para>
/// Every route here is owner-only, which is stricter than <see cref="BirthdayController"/>, where a
/// single birthday is readable by anyone signed in. A test result says a good deal more about
/// somebody than the day they were born, so no route lets a caller name a user other than themselves.
/// </para>
/// <para>
/// Every route pins the id to an int. The column behind it is an INT foreign key, so an id that is
/// not one cannot name a row — and pinning it in the route means the id is never parsed anywhere that
/// would have to answer for the failure.
/// </para>
/// </remarks>
[ApiController]
[Authorize]
[Route("bdsm")]
public sealed class BdsmController(BdsmService results, ILogger<BdsmController> logger) : ControllerBase
{
    /// <summary>
    /// The caller's own test results, newest first.
    /// </summary>
    /// <remarks>
    /// A list rather than a single result: the table is keyed by the test rather than the user, so
    /// somebody who has taken it more than once has a history to show. An empty list is the ordinary
    /// answer for somebody who never took it, which is why this does not 404.
    /// </remarks>
    [HttpGet("{userId:int}")]
    public async Task<IActionResult> GetResults(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        var found = await results.GetForUserAsync(userId, cancellationToken);
        return Ok(found.Select(BdsmResultResponse.From));
    }

    /// <summary>
    /// The most recent test of everyone following the channel, plus the channel owner's own.
    /// </summary>
    /// <remarks>
    /// Owner-only for a second reason on top of the one above: the follower list is fetched with the
    /// broadcaster's own stored Twitch token, so letting a caller name somebody else would hand them a
    /// read of another channel's followers.
    /// </remarks>
    [HttpGet("followers/{userId:int}")]
    public async Task<IActionResult> GetFollowerResults(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        try
        {
            var found = await results.GetForFollowersAsync(userId, cancellationToken);
            return Ok(found.Select(BdsmResultResponse.From));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            // Coarser than TwitchController's mapping on purpose: the only way to get here is a
            // missing token or an unreachable Twitch, and neither is the caller's to fix.
            logger.LogWarning(exception, "Cannot read the followers of channel {UserId}", userId);
            return StatusCode(StatusCodes.Status502BadGateway);
        }
    }

    /// <returns>The result to return, or <c>null</c> when the caller may proceed.</returns>
    private IActionResult? Denied(string userId)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (!string.Equals(twitchId, userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to reach the BDSM results of user {UserId}", twitchId, userId);
            return Forbid();
        }

        return null;
    }
}
