using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("twitch")]
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

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers(
        [FromQuery(Name = "id")] string[]? id,
        [FromQuery(Name = "login")] string[]? login,
        CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        var userIds = Clean(id);
        var logins = Clean(login);

        var total = userIds.Count + logins.Count;
        if (total is 0 or > TwitchApiClient.MaxBatchSize)
        {
            return BadRequest(
                $"Pass between 1 and {TwitchApiClient.MaxBatchSize} id and login values in total, got {total}.");
        }

        try
        {
            var users = await channelService.GetUsersAsync(twitchId, userIds, logins, cancellationToken);
            return Ok(users);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, $"look up {total} Twitch users");
        }
    }

    [HttpGet("moderators")]
    public Task<IActionResult> GetModerators(CancellationToken cancellationToken)
    {
        return ListChannelUsersAsync(
            broadcasterId => channelService.GetModeratorsAsync(broadcasterId, cancellationToken),
            "list the moderators");
    }

    [HttpGet("vips")]
    public Task<IActionResult> GetVips(CancellationToken cancellationToken)
    {
        return ListChannelUsersAsync(
            broadcasterId => channelService.GetVipsAsync(broadcasterId, cancellationToken),
            "list the VIPs");
    }

    [HttpGet("blocked")]
    public Task<IActionResult> GetBlockedUsers(CancellationToken cancellationToken)
    {
        return ListChannelUsersAsync(
            broadcasterId => channelService.GetBlockedUsersAsync(broadcasterId, cancellationToken),
            "list the blocked users");
    }

    [HttpGet("banned/{userId}")]
    public async Task<IActionResult> GetBanStatus(string userId, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var ban = await channelService.GetBannedUserAsync(twitchId, userId, cancellationToken);
            return Ok(BanStatusResponse.From(ban));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, $"check whether {userId} is banned");
        }
    }

    [HttpDelete("banned/{userId}")]
    public Task<IActionResult> UnbanUser(string userId, CancellationToken cancellationToken)
    {
        return EditChannelAsync(
            broadcasterId => channelService.UnbanUserAsync(broadcasterId, userId, cancellationToken),
            $"unban {userId}");
    }

    [HttpDelete("blocked/{userId}")]
    public Task<IActionResult> UnblockUser(string userId, CancellationToken cancellationToken)
    {
        return EditChannelAsync(
            broadcasterId => channelService.UnblockUserAsync(broadcasterId, userId, cancellationToken),
            $"unblock {userId}");
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

    private async Task<IActionResult> ListChannelUsersAsync(
        Func<string, Task<IReadOnlyList<TwitchChannelUser>>> list, string description)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var users = await list(twitchId);
            return Ok(users.Select(ChannelUserResponse.From));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, description);
        }
    }

    private static List<string> Clean(string[]? values)
    {
        return values is null
            ? []
            : values.Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value.Trim()).ToList();
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