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
    [HttpPost("{userId}/join")]
    public async Task<IActionResult> Join(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        return Answer(await bot.JoinChannelAsync(userId, cancellationToken));
    }

    [HttpPost("{userId}/leave")]
    public async Task<IActionResult> Leave(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        return Answer(await bot.LeaveChannelAsync(userId, cancellationToken));
    }

    private IActionResult Answer(YeppBotResult result)
    {
        if (result.Success) return Ok(result);

        var status = result.Status is >= 400 and < 600 ? result.Status : StatusCodes.Status502BadGateway;

        // The dashboard's own credentials are fine — it is ours to the bot that is not, and that is
        // an operator problem rather than something to ask the reader to log in again over.
        if (status is StatusCodes.Status401Unauthorized or StatusCodes.Status403Forbidden)
        {
            logger.LogError("YEPPBot rejected this dashboard's API key: {Message}", result.Message);
            status = StatusCodes.Status502BadGateway;
        }

        return StatusCode(status, result);
    }

    private IActionResult? Denied(string userId)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        // A session only ever speaks for its own channel — without this any logged-in user could
        // pull the bot out of somebody else's chat.
        if (!string.Equals(twitchId, userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to move the bot in channel {UserId}", twitchId, userId);
            return Forbid();
        }

        return null;
    }
}
