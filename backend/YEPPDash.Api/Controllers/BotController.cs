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
    /// <summary>Asks the bot to join the channel's chat. Answering twice is not an error.</summary>
    [HttpPost("{userId}/join")]
    public async Task<IActionResult> Join(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        return Answer(await bot.JoinChannelAsync(userId, cancellationToken));
    }

    /// <summary>Asks the bot to leave the channel's chat.</summary>
    [HttpPost("{userId}/leave")]
    public async Task<IActionResult> Leave(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        return Answer(await bot.LeaveChannelAsync(userId, cancellationToken));
    }

    /// <summary>
    /// Turns what the bot said into a response of our own. Its status travels where it is one the
    /// caller can act on; anything else reads as "the thing behind us went wrong", which is what a
    /// bot that is down or unconfigured is from the browser's point of view.
    /// </summary>
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

    /// <returns>The result to return, or <c>null</c> when the caller may proceed.</returns>
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
