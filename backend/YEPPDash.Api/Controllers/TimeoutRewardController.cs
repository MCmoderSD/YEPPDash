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
public sealed class TimeoutRewardController(
    TimeoutRewardService rewards,
    ILogger<TimeoutRewardController> logger) : ControllerBase
{
    private const int TimeoutMaxSeconds = 1_209_600;

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
            return this.TwitchFailure(logger, exception, "read the timeout reward");
        }
    }

    [HttpPut]
    public async Task<IActionResult> Save([FromBody] TimeoutRewardUpdate update, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        var reward = RewardValidation.Invalid(
            new RewardValidation.Fields(
                update.Title,
                update.Cost,
                update.Prompt,
                update.BackgroundColor,
                update.CooldownSeconds,
                update.MaxPerStream,
                update.MaxPerUserPerStream),
            "reward");

        if (reward is not null) return BadRequest(reward);
        if (update.DurationSeconds is < 1 or > TimeoutMaxSeconds) return BadRequest($"A timeout has to run between 1 and {TimeoutMaxSeconds} seconds.");

        try
        {
            return Ok(await rewards.SaveAsync(twitchId, update, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, $"save the timeout reward '{update.Title}'");
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
            return this.TwitchFailure(logger, exception, "remove the timeout reward");
        }
    }
}