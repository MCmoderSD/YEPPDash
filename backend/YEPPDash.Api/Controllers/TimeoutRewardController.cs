using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.TimeoutReward;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("timeout-reward")]
public sealed partial class TimeoutRewardController(
    TimeoutRewardService rewards,
    ILogger<TimeoutRewardController> logger) : ControllerBase
{
    private const int TitleMaxLength = 45;
    private const int PromptMaxLength = 200;
    private const int TimeoutMaxSeconds = 1_209_600;
    private const long CooldownMaxSeconds = 604_800;

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var settings = await rewards.GetAsync(twitchId, cancellationToken);
            return settings is null ? NoContent() : Ok(settings);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, "read the timeout reward");
        }
    }

    [HttpPut]
    public async Task<IActionResult> Save([FromBody] TimeoutRewardUpdate update, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(update.Title)) return BadRequest("The reward needs a name.");
        if (update.Title.Length > TitleMaxLength) return BadRequest($"A reward name cannot be longer than {TitleMaxLength} characters.");
        if (update.Cost < 1) return BadRequest("A reward has to cost at least 1 channel point.");
        if (update.Prompt?.Length > PromptMaxLength) return BadRequest($"A reward description cannot be longer than {PromptMaxLength} characters.");
        if (update.BackgroundColor is not null && !HexColor().IsMatch(update.BackgroundColor)) return BadRequest("A background color has to be a hex color like #9147FF.");
        if (update.DurationSeconds is < 1 or > TimeoutMaxSeconds) return BadRequest($"A timeout has to run between 1 and {TimeoutMaxSeconds} seconds.");
        if (update.CooldownSeconds is < 0 or > CooldownMaxSeconds) return BadRequest($"A cooldown has to be between 0 and {CooldownMaxSeconds} seconds.");
        if (update.MaxPerStream is < 0) return BadRequest("A per-stream limit cannot be negative.");
        if (update.MaxPerUserPerStream is < 0) return BadRequest("A per-user limit cannot be negative.");

        try
        {
            return Ok(await rewards.SaveAsync(twitchId, update, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, $"save the timeout reward '{update.Title}'");
        }
    }

    [HttpDelete]
    public async Task<IActionResult> Delete(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            await rewards.DeleteAsync(twitchId, cancellationToken);
            return NoContent();
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return HandleTwitchFailure(exception, "remove the timeout reward");
        }
    }

    [GeneratedRegex("^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")]
    private static partial Regex HexColor();

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