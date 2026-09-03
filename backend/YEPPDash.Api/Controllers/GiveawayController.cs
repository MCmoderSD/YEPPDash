using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Giveaway;
using YEPPDash.Api.Exceptions.Giveaway;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;
using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("giveaway")]
public sealed class GiveawayController(
    GiveawayService giveaways,
    GiveawayHub hub,
    ILogger<GiveawayController> logger) : ControllerBase
{
    private const double MultiplierMin = 0;
    private const double MultiplierMax = 1_000_000_000;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            return Ok(await giveaways.ListAsync(twitchId, cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, "read the giveaways");
        }
    }

    [HttpGet("count")]
    public async Task<IActionResult> Count(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        return Ok(await giveaways.CountAsync(twitchId, cancellationToken));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var settings = await giveaways.GetAsync(twitchId, id, cancellationToken);
            return settings is null ? NotFound() : Ok(settings);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, $"read giveaway {id}");
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] GiveawayUpdate update, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (Invalid(update) is { } problem) return BadRequest(problem);

        try
        {
            return Ok(await giveaways.CreateAsync(twitchId, Normalize(update), cancellationToken));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, $"create the giveaway '{update.Title}'");
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Save(Guid id, [FromBody] GiveawayUpdate update, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (Invalid(update) is { } problem) return BadRequest(problem);

        try
        {
            var settings = await giveaways.UpdateAsync(twitchId, id, Normalize(update), cancellationToken);
            return settings is null ? NotFound() : Ok(settings);
        }
        catch (InvalidGiveawayException exception)
        {
            return BadRequest(exception.Message);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, $"save the giveaway '{update.Title}'");
        }
    }

    [HttpPost("{id:guid}/open")]
    public async Task<IActionResult> Open(Guid id, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var settings = await giveaways.OpenAsync(twitchId, id, cancellationToken);
            return settings is null ? NotFound() : Ok(settings);
        }
        catch (InvalidGiveawayException exception)
        {
            return BadRequest(exception.Message);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, $"open giveaway {id}");
        }
    }

    [HttpPost("{id:guid}/close")]
    public async Task<IActionResult> Close(Guid id, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var settings = await giveaways.CloseAsync(twitchId, id, cancellationToken);
            return settings is null ? NotFound() : Ok(settings);
        }
        catch (InvalidGiveawayException exception)
        {
            return BadRequest(exception.Message);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, $"close giveaway {id}");
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            return await giveaways.DeleteAsync(twitchId, id, cancellationToken) ? NoContent() : NotFound();
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, $"delete giveaway {id}");
        }
    }

    [HttpDelete("{id:guid}/participants/{userId}")]
    public async Task<IActionResult> RemoveParticipant(Guid id, string userId, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        return await giveaways.RemoveParticipantAsync(twitchId, id, userId, cancellationToken) ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/reset")]
    public async Task<IActionResult> Reset(Guid id, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var settings = await giveaways.ResetAsync(twitchId, id, cancellationToken);
            return settings is null ? NotFound() : Ok(settings);
        }
        catch (InvalidGiveawayException exception)
        {
            return BadRequest(exception.Message);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            return this.TwitchFailure(logger, exception, $"reset giveaway {id}");
        }
    }

    [HttpPost("{id:guid}/draw")]
    public async Task<IActionResult> Draw(Guid id, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var draw = await giveaways.DrawAsync(twitchId, id, cancellationToken);
            return draw is null ? NotFound() : Ok(draw);
        }
        catch (InvalidGiveawayException exception)
        {
            return BadRequest(exception.Message);
        }
    }

    [HttpPost("{id:guid}/dismiss")]
    public IActionResult Dismiss(Guid id)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        giveaways.Dismiss(int.Parse(twitchId), id);

        return NoContent();
    }

    [HttpGet("stream")]
    public async Task Stream(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();

        if (twitchId is null || !int.TryParse(twitchId, out var channelId))
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        await StreamAsync(channelId, StreamAudience.Dashboard, cancellationToken);
    }

    [AllowAnonymous]
    [HttpGet("overlay/{id:guid}")]
    public async Task<IActionResult> GetOverlay(Guid id, CancellationToken cancellationToken)
        => Ok(new GiveawayOverlayResponse(await giveaways.OverlayAsync(id, cancellationToken)));

    [AllowAnonymous]
    [HttpGet("overlay/{id:guid}/stream")]
    public async Task OverlayStream(Guid id, CancellationToken cancellationToken)
    {
        var channelId = await giveaways.ChannelOfAsync(id, cancellationToken);

        if (channelId is null)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        await StreamAsync(channelId.Value, StreamAudience.Overlay, cancellationToken);
    }

    private async Task StreamAsync(int channelId, StreamAudience audience, CancellationToken cancellationToken)
    {
        using var subscription = hub.Subscribe(channelId, audience);
        logger.LogDebug("A {Audience} is watching the giveaways of channel {ChannelId}", audience, channelId);

        await Response.StreamAsync(subscription, cancellationToken);

        logger.LogDebug("A {Audience} stopped watching the giveaways of channel {ChannelId}", audience, channelId);
    }

    private static string? Invalid(GiveawayUpdate update)
    {
        var reward = RewardValidation.Invalid(
            new RewardValidation.Fields(
                update.Title,
                update.Cost,
                update.Description,
                update.BackgroundColor,
                update.CooldownSeconds,
                update.MaxPerStream,
                update.MaxPerUserPerStream),
            "giveaway");

        if (reward is not null) return reward;

        var multipliers = update.Multipliers;

        if (!double.IsFinite(multipliers.Base) || multipliers.Base <= 0 || Round(multipliers.Base) > MultiplierMax)
        {
            return $"The base multiplier has to be greater than 0 and at most {MultiplierMax}.";
        }

        double[] values =
        [
            multipliers.Follower, multipliers.Subscriber, multipliers.Tier2,
            multipliers.Tier3, multipliers.Vip, multipliers.Moderator,
        ];

        return values.Any(OutOfRange)
            ? $"A multiplier has to be between {MultiplierMin} and {MultiplierMax}."
            : null;
    }

    private static GiveawayUpdate Normalize(GiveawayUpdate update)
    {
        var multipliers = update.Multipliers;

        return update with
        {
            Title = update.Title.Trim(),
            Multipliers = new GiveawayMultipliers(
                Round(multipliers.Base),
                Round(multipliers.Follower),
                Round(multipliers.Subscriber),
                Round(multipliers.Tier2),
                Round(multipliers.Tier3),
                Round(multipliers.Vip),
                Round(multipliers.Moderator)),
        };
    }

    private static bool OutOfRange(double multiplier)
    {
        return !double.IsFinite(multiplier) || Round(multiplier) < MultiplierMin || Round(multiplier) > MultiplierMax;
    }

    private static double Round(double multiplier)
    {
        return double.IsFinite(multiplier) ? Math.Round(multiplier, 2) : 1;
    }
}