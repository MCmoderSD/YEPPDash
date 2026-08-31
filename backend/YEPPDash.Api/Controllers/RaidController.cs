using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("raids")]
public sealed class RaidController(RaidService raids, ILogger<RaidController> logger) : ControllerBase
{
    [HttpGet("count")]
    public async Task<IActionResult> CountRaids(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        return Ok(new CountResponse(await raids.CountForChannelAsync(twitchId, cancellationToken)));
    }

    [HttpGet]
    public async Task<IActionResult> GetRaids(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            return Ok(await raids.GetForChannelAsync(twitchId, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            logger.LogWarning(exception, "Cannot resolve the raiders of channel {TwitchId}", twitchId);
            return StatusCode(StatusCodes.Status502BadGateway);
        }
    }
}