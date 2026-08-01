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
        if (total is 0) return BadRequest("Pass at least one id or login value.");

        try
        {
            var users = await channelService.GetUserProfilesAsync(twitchId, userIds, logins, cancellationToken);
            return Ok(users.Select(TwitchUserResponse.From));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, $"look up {total} Twitch users");
        }
    }

    [HttpGet("moderators")]
    public Task<IActionResult> GetModerators(CancellationToken cancellationToken)
    {
        return ListUserProfilesAsync(
            broadcasterId => channelService.GetModeratorProfilesAsync(broadcasterId, cancellationToken),
            user => new ModeratorResponse(user),
            "list the moderators");
    }

    [HttpGet("moderators/check")]
    public Task<IActionResult> CheckModerators(
        [FromQuery(Name = "id")] string[]? id, CancellationToken cancellationToken)
    {
        return CheckChannelUsersAsync(
            id,
            (broadcasterId, userIds) =>
                channelService.GetModeratorsByIdAsync(broadcasterId, userIds, cancellationToken),
            ChannelUserResponse.From,
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

    [HttpGet("vips")]
    public Task<IActionResult> GetVips(CancellationToken cancellationToken)
    {
        return ListUserProfilesAsync(
            broadcasterId => channelService.GetVipProfilesAsync(broadcasterId, cancellationToken),
            user => new VipResponse(user),
            "list the VIPs");
    }

    [HttpGet("vips/check")]
    public Task<IActionResult> CheckVips(
        [FromQuery(Name = "id")] string[]? id, CancellationToken cancellationToken)
    {
        return CheckChannelUsersAsync(
            id,
            (broadcasterId, userIds) =>
                channelService.GetVipsByIdAsync(broadcasterId, userIds, cancellationToken),
            ChannelUserResponse.From,
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

    [HttpGet("editors")]
    public async Task<IActionResult> GetEditors(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var editors = await channelService.GetEditorProfilesAsync(twitchId, cancellationToken);
            return Ok(editors.Select(editor => new EditorResponse(editor.User, editor.EditorSince)));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, "list the editors");
        }
    }

    // Twitch has no filtered form of Get Channel Editors, so the service matches against the full
    // list. The ids never leave this side, which is why this check has no batch limit at all.
    [HttpGet("editors/check")]
    public Task<IActionResult> CheckEditors(
        [FromQuery(Name = "id")] string[]? id, CancellationToken cancellationToken)
    {
        return CheckChannelUsersAsync(
            id,
            (broadcasterId, userIds) =>
                channelService.GetEditorsByIdAsync(broadcasterId, userIds, cancellationToken),
            ChannelEditorResponse.From,
            "are editors");
    }

    [HttpGet("followers")]
    public async Task<IActionResult> GetFollowers(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var followers = await channelService.GetFollowerProfilesAsync(twitchId, cancellationToken);
            return Ok(followers.Select(follower => new FollowerProfileResponse(follower.User, follower.FollowedAt)));
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
            var follow = await channelService.GetFollowerAsync(twitchId, userId, cancellationToken);
            return Ok(FollowStatusResponse.From(follow));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, $"check whether {userId} follows the channel");
        }
    }

    [HttpGet("chatters")]
    public Task<IActionResult> GetChatters(CancellationToken cancellationToken)
    {
        return ListChannelUsersAsync(
            broadcasterId => channelService.GetChattersAsync(broadcasterId, cancellationToken),
            "list the chatters");
    }

    [HttpGet("blocked")]
    public Task<IActionResult> GetBlockedUsers(CancellationToken cancellationToken)
    {
        return ListChannelUsersAsync(
            broadcasterId => channelService.GetBlockedUsersAsync(broadcasterId, cancellationToken),
            "list the blocked users");
    }

    [HttpDelete("blocked/{userId}")]
    public Task<IActionResult> UnblockUser(string userId, CancellationToken cancellationToken)
    {
        return EditChannelAsync(
            broadcasterId => channelService.UnblockUserAsync(broadcasterId, userId, cancellationToken),
            $"unblock {userId}");
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

    private async Task<IActionResult> CheckChannelUsersAsync<T>(
        string[]? id,
        Func<string, IReadOnlyCollection<string>, Task<IReadOnlyList<T>>> check,
        Func<T, object> toResponse,
        string role)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        var userIds = Clean(id);
        if (userIds.Count is 0) return BadRequest("Pass at least one id value.");

        try
        {
            var found = await check(twitchId, userIds);
            return Ok(found.Select(toResponse));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, $"check whether {userIds.Count} users {role}");
        }
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

    private async Task<IActionResult> ListUserProfilesAsync(
        Func<string, Task<IReadOnlyList<TwitchUser>>> list,
        Func<TwitchUser, TwitchUserResponse> toResponse,
        string description)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var users = await list(twitchId);
            return Ok(users.Select(toResponse));
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