using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("twitch")]
public sealed partial class TwitchController(
    TwitchChannelService channelService,
    ILogger<TwitchController> logger) : ControllerBase
{
    private const int TitleMaxLength = 140;
    private const int TagMaxCount = 10;
    private const int TagMaxLength = 25;
    private const int DelayMaxSeconds = 900;
    private const int CategoryPageSize = 20;

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

    
    [HttpGet("moderators/count")]
    public Task<IActionResult> CountModerators(CancellationToken cancellationToken)
    {
        return CountAsync(
            broadcasterId => channelService.GetModeratorCountAsync(broadcasterId, cancellationToken),
            "count the moderators");
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

    
    [HttpGet("vips/count")]
    public Task<IActionResult> CountVips(CancellationToken cancellationToken)
    {
        return CountAsync(
            broadcasterId => channelService.GetVipCountAsync(broadcasterId, cancellationToken),
            "count the VIPs");
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

    
    [HttpGet("followers/count")]
    public Task<IActionResult> CountFollowers(CancellationToken cancellationToken)
    {
        return CountAsync(
            broadcasterId => channelService.GetFollowerCountAsync(broadcasterId, cancellationToken),
            "count the followers");
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


    [HttpGet("blocked/check")]
    public Task<IActionResult> CheckBlockedUsers([FromQuery(Name = "id")] string[]? id, CancellationToken cancellationToken)
    {
        return CheckChannelUsersAsync(
            id,
            (broadcasterId, userIds) => channelService.GetBlockedUsersByIdAsync(broadcasterId, userIds, cancellationToken),
            "are blocked");
    }

    
    [HttpDelete("blocked/{userId}")]
    public Task<IActionResult> UnblockUser(string userId, CancellationToken cancellationToken)
    {
        return EditChannelAsync(
            broadcasterId => channelService.UnblockUserAsync(broadcasterId, userId, cancellationToken),
            $"unblock {userId}");
    }
    #endregion

    
    #region Channel

    [HttpGet("channel")]
    public async Task<IActionResult> GetChannel(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var channel = await channelService.GetChannelAsync(twitchId, cancellationToken);

            return channel is null ? NotFound("Twitch has no channel under this account.") : Ok(channel);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, "read the channel information");
        }
    }

    [HttpPatch("channel")]
    public async Task<IActionResult> UpdateChannel([FromBody] ChannelUpdate update, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (update is { Title: null, GameId: null, Tags: null, IsBrandedContent: null,
                        BroadcasterLanguage: null, Delay: null, ContentClassificationLabels: null })
        {
            return BadRequest("Pass something to change — an empty change is not one.");
        }

        if (update.Title is not null)
        {
            if (string.IsNullOrWhiteSpace(update.Title)) return BadRequest("A stream title cannot be empty.");
            if (update.Title.Length > TitleMaxLength) return BadRequest($"A stream title cannot be longer than {TitleMaxLength} characters.");
        }

        if (update.Tags is { } tags)
        {
            if (tags.Count > TagMaxCount) return BadRequest($"A channel can have at most {TagMaxCount} tags.");

            if (tags.Any(string.IsNullOrWhiteSpace)) return BadRequest("A tag cannot be empty.");
            if (tags.Any(tag => tag.Any(char.IsWhiteSpace))) return BadRequest("A tag cannot contain spaces.");
            if (tags.Any(tag => tag.Length > TagMaxLength)) return BadRequest($"A tag cannot be longer than {TagMaxLength} characters.");
        }

        if (update.BroadcasterLanguage is { } language && !LanguageCode().IsMatch(language))
        {
            return BadRequest("A language has to be a Twitch language code, or 'other'.");
        }

        if (update.Delay is < 0 or > DelayMaxSeconds)
        {
            return BadRequest($"A stream delay has to be between 0 and {DelayMaxSeconds} seconds.");
        }

        if (update.ContentClassificationLabels is { } labels && labels.FirstOrDefault(label => !ContentClassificationLabels.Known.Contains(label.Id)) is { } unknown)
        {
            return BadRequest($"'{unknown.Id}' is not a content classification label Twitch knows.");
        }

        try
        {
            var channel = await channelService.UpdateChannelAsync(twitchId, update, cancellationToken);

            return channel is null ? NotFound("Twitch has no channel under this account.") : Ok(channel);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, "update the channel information");
        }
    }

    [HttpGet("games")]
    public async Task<IActionResult> GetGames([FromQuery(Name = "id")] string[]? id, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        var gameIds = Clean(id);
        if (gameIds.Count is 0) return BadRequest("Pass at least one game id.");

        try
        {
            return Ok(await channelService.GetGamesAsync(twitchId, gameIds, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, $"look up {gameIds.Count} games");
        }
    }

    [HttpGet("categories")]
    public async Task<IActionResult> SearchCategories([FromQuery] string? query, [FromQuery] string? after, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        var search = query?.Trim();
        if (string.IsNullOrEmpty(search)) return BadRequest("Pass something to search for.");

        try
        {
            var page = await channelService.SearchCategoriesAsync(twitchId, search, CategoryPageSize, string.IsNullOrEmpty(after) ? null : after, cancellationToken);

            return Ok(page);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, $"search categories for '{search}'");
        }
    }
    #endregion


    #region Stream

    [HttpGet("stream")]
    public async Task<IActionResult> GetStream(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            return Ok(await channelService.GetStreamStatusAsync(twitchId, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, "read the stream status");
        }
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


    [HttpGet("chatters/count")]
    public Task<IActionResult> CountChatters(CancellationToken cancellationToken)
    {
        return CountAsync(
            broadcasterId => channelService.GetChatterCountAsync(broadcasterId, cancellationToken),
            "count the chatters");
    }


    [HttpGet("chatters/check")]
    public Task<IActionResult> CheckChatters([FromQuery(Name = "id")] string[]? id, CancellationToken cancellationToken)
    {
        return CheckChannelUsersAsync(
            id,
            (broadcasterId, userIds) => channelService.GetChattersByIdAsync(broadcasterId, userIds, cancellationToken),
            "are in chat");
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

    private async Task<IActionResult> CountAsync(Func<string, Task<int>> count, string description)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            return Ok(new CountResponse(await count(twitchId)));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, description);
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

    [GeneratedRegex("^(other|[a-z]{2,3}(-[a-z]{2,4})?)$", RegexOptions.IgnoreCase)]
    private static partial Regex LanguageCode();

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