using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.SubathonTimer;
using YEPPDash.Api.Exceptions.SubathonTimer;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;
using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("timer")]
public sealed class SubathonTimerController(
    SubathonTimerService timers,
    SubathonTimerHub hub,
    ILogger<SubathonTimerController> logger) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("{userId}")]
    public async Task<IActionResult> GetTimer(string userId, CancellationToken cancellationToken)
    {
        if (!int.TryParse(userId, out _)) return BadRequest("That is not a Twitch user ID.");

        var state = await timers.GetAsync(userId, cancellationToken);

        return Ok(SubathonTimerResponse.From(state, DateTime.UtcNow));
    }

    [AllowAnonymous]
    [HttpGet("{userId}/stream")]
    public async Task Stream(string userId, CancellationToken cancellationToken)
    {
        if (!int.TryParse(userId, out var channelId))
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        using var subscription = hub.Subscribe(channelId);
        logger.LogDebug("An overlay is watching the timer of channel {ChannelId}", channelId);

        await Response.StreamAsync(subscription, cancellationToken);

        logger.LogDebug("An overlay stopped watching the timer of channel {ChannelId}", channelId);
    }

    [HttpPost("{userId}/start")]
    public Task<IActionResult> Start(string userId, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => timers.StartAsync(userId, token), cancellationToken);
    }

    [HttpPost("{userId}/pause")]
    public Task<IActionResult> Pause(string userId, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => timers.PauseAsync(userId, token), cancellationToken);
    }

    [HttpPost("{userId}/reset")]
    public Task<IActionResult> Reset(string userId, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => timers.ResetAsync(userId, token), cancellationToken);
    }

    [HttpPost("{userId}/adjust")]
    public Task<IActionResult> Adjust(string userId, [FromBody] SubathonTimerSecondsRequest request, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => timers.AdjustAsync(userId, request.Seconds, token), cancellationToken);
    }

    [HttpPost("{userId}/set")]
    public Task<IActionResult> Set(string userId, [FromBody] SubathonTimerSecondsRequest request, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => timers.SetAsync(userId, request.Seconds, token), cancellationToken);
    }

    [HttpPut("{userId}/config")]
    public Task<IActionResult> SaveConfig(string userId, [FromBody] SubathonTimerConfigRequest request, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => timers.SaveConfigAsync(userId, request.StartSeconds, token), cancellationToken);
    }

    [HttpPut("{userId}/style")]
    public Task<IActionResult> SaveStyle(string userId, [FromBody] SubathonTimerStyleRequest request, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => timers.SaveStyleAsync(userId, request.Style, token), cancellationToken);
    }

    private async Task<IActionResult> CommandAsync(string userId, Func<CancellationToken, Task<SubathonTimerState>> command, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        try
        {
            var state = await command(cancellationToken);

            return Ok(SubathonTimerResponse.From(state, DateTime.UtcNow));
        }
        catch (InvalidSubathonTimerException exception)
        {
            return BadRequest(exception.Message);
        }
    }

    private IActionResult? Denied(string userId)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (!string.Equals(twitchId, userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to reach the timer of channel {UserId}", twitchId, userId);
            return Forbid();
        }

        return null;
    }
}