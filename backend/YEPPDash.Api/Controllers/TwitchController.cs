using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/twitch")]
public sealed class TwitchController(
    TwitchChannelService channelService,
    ILogger<TwitchController> logger) : ControllerBase
{
    [HttpGet("chat-color/{userId?}")]
    public async Task<IActionResult> GetChatColor(string? userId, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var color = await channelService.GetChatColorAsync(twitchId, userId ?? twitchId, cancellationToken);
            return color is null ? NotFound() : Ok(new ChatColorResponse(color.UserId, color.Color));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, $"read the chat colour of {userId ?? twitchId}");
        }
    }

    [HttpPost("moderators/{userId}")]
    public Task<IActionResult> AddModerator(string userId, CancellationToken cancellationToken)
    {
        return EditChannelAsync(
            broadcasterId => channelService.AddModeratorAsync(broadcasterId, userId, cancellationToken),
            $"add {userId} as moderator");
    }

    [HttpDelete("moderators/{userId}")]
    public Task<IActionResult> RemoveModerator(string userId, CancellationToken cancellationToken)
    {
        return EditChannelAsync(
            broadcasterId => channelService.RemoveModeratorAsync(broadcasterId, userId, cancellationToken),
            $"remove {userId} as moderator");
    }

    [HttpPost("vips/{userId}")]
    public Task<IActionResult> AddVip(string userId, CancellationToken cancellationToken)
    {
        return EditChannelAsync(
            broadcasterId => channelService.AddVipAsync(broadcasterId, userId, cancellationToken),
            $"add {userId} as VIP");
    }

    [HttpDelete("vips/{userId}")]
    public Task<IActionResult> RemoveVip(string userId, CancellationToken cancellationToken)
    {
        return EditChannelAsync(
            broadcasterId => channelService.RemoveVipAsync(broadcasterId, userId, cancellationToken),
            $"remove {userId} as VIP");
    }

    private async Task<IActionResult> EditChannelAsync(Func<string, Task> edit, string description)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            await edit(twitchId);
            return NoContent();
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, description);
        }
    }

    private IActionResult HandleTwitchFailure(Exception exception, string description)
    {
        if (exception is not TwitchOAuthException twitchException)
        {
            logger.LogWarning(exception, "Twitch is unreachable, cannot {Description}", description);
            return StatusCode(StatusCodes.Status502BadGateway);
        }

        logger.LogWarning(
            "Twitch refused to {Description} ({StatusCode}): {Body}",
            description, twitchException.StatusCode, twitchException.ResponseBody);

        var status = (int)twitchException.StatusCode;
        return status is >= 400 and < 500
            ? StatusCode(status)
            : StatusCode(StatusCodes.Status502BadGateway);
    }
}