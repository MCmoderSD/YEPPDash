using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Bdsm;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("bdsm")]
public sealed class BdsmController(BdsmService results, ILogger<BdsmController> logger) : ControllerBase
{
    [HttpGet("{userId:int}")]
    public async Task<IActionResult> GetResults(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        var found = await results.GetForUserAsync(userId, cancellationToken);
        return Ok(found.Select(BdsmResultResponse.From));
    }

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
            logger.LogWarning(exception, "Cannot read the followers of channel {UserId}", userId);
            return StatusCode(StatusCodes.Status502BadGateway);
        }
    }

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