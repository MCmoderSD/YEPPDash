using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Bot;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("bot")]
public sealed class BotController(YeppBotClient bot, ILogger<BotController> logger) : ControllerBase
{
    [HttpPost("{userId:int}/join")]
    public async Task<IActionResult> Join(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        return Answer(await bot.JoinChannelAsync(userId, cancellationToken));
    }

    [HttpPost("{userId:int}/leave")]
    public async Task<IActionResult> Leave(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        return Answer(await bot.LeaveChannelAsync(userId, cancellationToken));
    }

    private IActionResult Answer(YeppBotResult result)
    {
        if (result.Success) return Ok(result);

        var status = result.Status is >= 400 and < 600 ? result.Status : StatusCodes.Status502BadGateway;

        if (status is StatusCodes.Status401Unauthorized or StatusCodes.Status403Forbidden)
        {
            logger.LogError("YEPPBot rejected this dashboard's API key: {Message}", LogSafe.OneLine(result.Message));
            status = StatusCodes.Status502BadGateway;
        }

        return StatusCode(status, result);
    }

    private IActionResult? Denied(string userId)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (!string.Equals(twitchId, userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to move the bot in channel {UserId}", twitchId, LogSafe.OneLine(userId));
            return Forbid();
        }

        return null;
    }
}
