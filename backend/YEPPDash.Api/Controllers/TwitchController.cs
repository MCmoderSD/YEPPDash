using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("twitch")]
public sealed class TwitchController(
    TwitchChannelService channelService,
    ILogger<TwitchController> logger) : ControllerBase
{

    #region Users
    
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery(Name = "id")] string[]? id, [FromQuery(Name = "login")] string[]? login, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        var userIds = Clean(id);
        var logins = Clean(login);

        var total = userIds.Count + logins.Count;
        if (total is 0) return BadRequest("Pass at least one id or login value.");

        try
        {
            var users = await channelService.GetUserProfilesAsync(twitchId, userIds, logins, cancellationToken);
            return Ok(users);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, $"look up {total} Twitch users");
        }
    }


    #endregion


    #region Moderators

    [HttpGet("moderators")]
    public Task<IActionResult> GetModerators(CancellationToken cancellationToken)
    {
        return ListUserProfilesAsync(
            broadcasterId => channelService.GetModeratorProfilesAsync(broadcasterId, cancellationToken),
            "list the moderators");
    }

    
    [HttpGet("moderators/check")]
    public Task<IActionResult> CheckModerators([FromQuery(Name = "id")] string[]? id, CancellationToken cancellationToken)
    {
        return CheckChannelUsersAsync(
            id,
            (broadcasterId, userIds) =>
                channelService.GetModeratorProfilesByIdAsync(broadcasterId, userIds, cancellationToken),
            "are moderators");
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
    #endregion
    
    
    #region VIPs
    
    [HttpGet("vips")]
    public Task<IActionResult> GetVips(CancellationToken cancellationToken)
    {
        return ListUserProfilesAsync(
            broadcasterId => channelService.GetVipProfilesAsync(broadcasterId, cancellationToken),
            "list the VIPs");
    }

    
    [HttpGet("vips/check")]
    public Task<IActionResult> CheckVips([FromQuery(Name = "id")] string[]? id, CancellationToken cancellationToken)
    {
        return CheckChannelUsersAsync(
            id,
            (broadcasterId, userIds) =>
                channelService.GetVipProfilesByIdAsync(broadcasterId, userIds, cancellationToken),
            "are VIPs");
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
    #endregion


    #region Editors
    
    [HttpGet("editors")]
    public async Task<IActionResult> GetEditors(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var editors = await channelService.GetEditorProfilesAsync(twitchId, cancellationToken);
            return Ok(editors);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, "list the editors");
        }
    }

    
    [HttpGet("editors/check")]
    public Task<IActionResult> CheckEditors([FromQuery(Name = "id")] string[]? id, CancellationToken cancellationToken)
    {
        return CheckChannelUsersAsync(
            id,
            (broadcasterId, userIds) =>
                channelService.GetEditorProfilesByIdAsync(broadcasterId, userIds, cancellationToken),
            "are editors");
    }
    #endregion


    #region Followers
    
    [HttpGet("followers")]
    public async Task<IActionResult> GetFollowers(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var followers = await channelService.GetFollowerProfilesAsync(twitchId, cancellationToken);
            return Ok(followers);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, "list the followers");
        }
    }

    
    [HttpGet("followers/{userId}")]
    public async Task<IActionResult> GetFollowStatus(string userId, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            return Ok(await channelService.GetFollowStatusAsync(twitchId, userId, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, $"check whether {userId} follows the channel");
        }
    }
    #endregion


    #region Bans

    [HttpGet("banned/{userId}")]
    public async Task<IActionResult> GetBanStatus(string userId, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            return Ok(await channelService.GetBanStatusAsync(twitchId, userId, cancellationToken));
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
    #endregion

    
    #region Blocks

    [HttpGet("blocked")]
    public Task<IActionResult> GetBlockedUsers(CancellationToken cancellationToken)
    {
        return ListUserProfilesAsync(
            broadcasterId => channelService.GetBlockedProfilesAsync(broadcasterId, cancellationToken),
            "list the blocked users");
    }

    
    [HttpDelete("blocked/{userId}")]
    public Task<IActionResult> UnblockUser(string userId, CancellationToken cancellationToken)
    {
        return EditChannelAsync(
            broadcasterId => channelService.UnblockUserAsync(broadcasterId, userId, cancellationToken),
            $"unblock {userId}");
    }
    #endregion

    
    #region Chat
    
    [HttpGet("chatters")]
    public Task<IActionResult> GetChatters(CancellationToken cancellationToken)
    {
        return ListUserProfilesAsync(
            broadcasterId => channelService.GetChatterProfilesAsync(broadcasterId, cancellationToken),
            "list the chatters");
    }
    #endregion


    private async Task<IActionResult> CheckChannelUsersAsync<T>(string[]? id, Func<string, IReadOnlyCollection<string>, Task<IReadOnlyList<T>>> check, string role)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        var userIds = Clean(id);
        if (userIds.Count is 0) return BadRequest("Pass at least one id value.");

        try
        {
            return Ok(await check(twitchId, userIds));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, $"check whether {userIds.Count} users {role}");
        }
    }

    private async Task<IActionResult> ListUserProfilesAsync(Func<string, Task<IReadOnlyList<TwitchUser>>> list, string description)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            return Ok(await list(twitchId));
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