using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;
using YEPPDash.Api.Twitch;

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
    private const long BanMaxSeconds = 1_209_600;
    private const int BanReasonMaxLength = 500;

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
            return this.TwitchFailure(logger, exception, $"look up {total} Twitch users");
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
            return this.TwitchFailure(logger, exception, "list the editors");
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
            return this.TwitchFailure(logger, exception, "list the followers");
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
            return this.TwitchFailure(logger, exception, $"check whether {userId} follows the channel");
        }
    }
    #endregion


    #region Bans

    [HttpGet("banned")]
    public async Task<IActionResult> GetBannedUsers(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            return Ok(await channelService.GetBannedProfilesAsync(twitchId, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, "list the banned users");
        }
    }


    [HttpGet("banned/count")]
    public async Task<IActionResult> CountBannedUsers(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            return Ok(await channelService.GetBanCountsAsync(twitchId, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, "count the banned users");
        }
    }


    [HttpPost("banned/{userId}")]
    public async Task<IActionResult> BanUser(string userId, [FromBody] BanCreate ban, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (ban.Duration is < 1 or > BanMaxSeconds)
        {
            return BadRequest($"A timeout has to run between 1 and {BanMaxSeconds} seconds; leave the duration out for a permanent ban.");
        }

        if (ban.Reason?.Length > BanReasonMaxLength)
        {
            return BadRequest($"A ban reason cannot be longer than {BanReasonMaxLength} characters.");
        }

        try
        {
            return Ok(await channelService.BanUserAsync(twitchId, userId, ban.Duration, ban.Reason, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, $"ban {userId}");
        }
    }


    [HttpGet("banned/{userId}")]
    public async Task<IActionResult> GetBan(string userId, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            return Ok(await channelService.GetBanProfileAsync(twitchId, userId, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, $"check whether {userId} is banned");
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
            return this.TwitchFailure(logger, exception, "read the channel information");
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
            return this.TwitchFailure(logger, exception, "update the channel information");
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
            return this.TwitchFailure(logger, exception, $"look up {gameIds.Count} games");
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
            return this.TwitchFailure(logger, exception, $"search categories for '{search}'");
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
            return this.TwitchFailure(logger, exception, "read the stream status");
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


    #region Channel Points

    [HttpGet("rewards")]
    public async Task<IActionResult> GetRewards([FromQuery(Name = "id")] string[]? id, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        var rewardIds = Clean(id);
        if (rewardIds.Count > TwitchApiClient.MaxRewardBatchSize)
        {
            return BadRequest($"Pass at most {TwitchApiClient.MaxRewardBatchSize} reward ids.");
        }

        try
        {
            return Ok(await channelService.GetCustomRewardsAsync(twitchId, rewardIds, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, "list the channel point rewards");
        }
    }


    [HttpPost("rewards")]
    public async Task<IActionResult> CreateReward([FromBody] CustomRewardCreate create, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (ValidateReward(create.Title, create.Cost, create.Prompt, create.BackgroundColor, create.MaxPerStream, create.MaxPerUserPerStream, create.GlobalCooldownSeconds) is { } error)
        {
            return BadRequest(error);
        }

        if (create.IsUserInputRequired is true && string.IsNullOrWhiteSpace(create.Prompt))
        {
            return BadRequest("A reward that asks for user input needs a prompt.");
        }

        try
        {
            return Ok(await channelService.CreateCustomRewardAsync(twitchId, create, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, $"create the reward '{create.Title}'");
        }
    }


    [HttpPatch("rewards/{rewardId}")]
    public async Task<IActionResult> UpdateReward(string rewardId, [FromBody] CustomRewardUpdate update, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (update is { Title: null, Cost: null, Prompt: null, IsEnabled: null, BackgroundColor: null,
                        IsUserInputRequired: null, IsMaxPerStreamEnabled: null, MaxPerStream: null,
                        IsMaxPerUserPerStreamEnabled: null, MaxPerUserPerStream: null,
                        IsGlobalCooldownEnabled: null, GlobalCooldownSeconds: null,
                        IsPaused: null, ShouldRedemptionsSkipRequestQueue: null })
        {
            return BadRequest("Pass something to change — an empty change is not one.");
        }

        if (ValidateReward(update.Title, update.Cost, update.Prompt, update.BackgroundColor, update.MaxPerStream, update.MaxPerUserPerStream, update.GlobalCooldownSeconds) is { } error)
        {
            return BadRequest(error);
        }

        try
        {
            return Ok(await channelService.UpdateCustomRewardAsync(twitchId, rewardId, update, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, $"update the reward {rewardId}");
        }
    }


    [HttpDelete("rewards/{rewardId}")]
    public Task<IActionResult> DeleteReward(string rewardId, CancellationToken cancellationToken)
    {
        return EditChannelAsync(
            broadcasterId => channelService.DeleteCustomRewardAsync(broadcasterId, rewardId, cancellationToken),
            $"delete the reward {rewardId}");
    }


    private static string? ValidateReward(string? title, long? cost, string? prompt, string? backgroundColor, long? maxPerStream, long? maxPerUserPerStream, long? globalCooldownSeconds)
    {
        if (title is not null)
        {
            if (string.IsNullOrWhiteSpace(title)) return "A reward title cannot be empty.";
            if (title.Length > RewardValidation.TitleMaxLength) return $"A reward title cannot be longer than {RewardValidation.TitleMaxLength} characters.";
        }

        if (cost is < 1) return "A reward has to cost at least 1 channel point.";
        if (prompt?.Length > RewardValidation.PromptMaxLength) return $"A reward prompt cannot be longer than {RewardValidation.PromptMaxLength} characters.";
        if (backgroundColor is not null && !RewardValidation.HexColor().IsMatch(backgroundColor)) return "A background color has to be a hex color like #9147FF.";
        if (maxPerStream is < 1) return "A per-stream limit has to be at least 1.";
        if (maxPerUserPerStream is < 1) return "A per-user limit has to be at least 1.";
        if (globalCooldownSeconds is < 1 or > RewardValidation.CooldownMaxSeconds) return $"A cooldown has to be between 1 and {RewardValidation.CooldownMaxSeconds} seconds.";

        return null;
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
            return this.TwitchFailure(logger, exception, $"check whether {userIds.Count} users {role}");
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
            return this.TwitchFailure(logger, exception, description);
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
            return this.TwitchFailure(logger, exception, description);
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
            return this.TwitchFailure(logger, exception, description);
        }
    }

    [GeneratedRegex("^(other|[a-z]{2,3}(-[a-z]{2,4})?)$", RegexOptions.IgnoreCase)]
    private static partial Regex LanguageCode();
}