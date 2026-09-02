using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Giveaway;
using YEPPDash.Api.Exceptions.Giveaway;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("giveaway")]
public sealed partial class GiveawayController(
    GiveawayService giveaways,
    GiveawayHub hub,
    ILogger<GiveawayController> logger) : ControllerBase
{
    private const int TitleMaxLength = 45;
    private const int DescriptionMaxLength = 200;

    private const long CooldownMaxSeconds = 604_800;

    private const double MultiplierMin = 0;
    private const double MultiplierMax = 1_000_000_000;

    private static readonly TimeSpan KeepAlive = TimeSpan.FromSeconds(20);

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
            return HandleTwitchFailure(exception, "read the giveaways");
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
            return HandleTwitchFailure(exception, $"read giveaway {id}");
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
            return HandleTwitchFailure(exception, $"create the giveaway '{update.Title}'");
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
            return HandleTwitchFailure(exception, $"save the giveaway '{update.Title}'");
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
            return HandleTwitchFailure(exception, $"open giveaway {id}");
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
            return HandleTwitchFailure(exception, $"close giveaway {id}");
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
            return HandleTwitchFailure(exception, $"delete giveaway {id}");
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
            return HandleTwitchFailure(exception, $"reset giveaway {id}");
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

        await StreamAsync(channelId, GiveawayAudience.Dashboard, cancellationToken);
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

        await StreamAsync(channelId.Value, GiveawayAudience.Overlay, cancellationToken);
    }

    private async Task StreamAsync(int channelId, GiveawayAudience audience, CancellationToken cancellationToken)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache, no-store";

        Response.Headers["X-Accel-Buffering"] = "no";

        using var subscription = hub.Subscribe(channelId, audience);
        logger.LogDebug("A {Audience} is watching the giveaways of channel {ChannelId}", audience, channelId);

        await WriteAsync(": connected\n\n", cancellationToken);

        while (!cancellationToken.IsCancellationRequested)
        {
            string payload;

            try
            {
                using var idle = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                idle.CancelAfter(KeepAlive);

                payload = await subscription.Reader.ReadAsync(idle.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                await WriteAsync(": keep-alive\n\n", cancellationToken);
                continue;
            }
            catch (OperationCanceledException)
            {
                break;
            }

            await WriteAsync($"data: {payload}\n\n", cancellationToken);
        }

        logger.LogDebug("A {Audience} stopped watching the giveaways of channel {ChannelId}", audience, channelId);
    }

    private async Task WriteAsync(string text, CancellationToken cancellationToken)
    {
        await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(text), cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }

    private static string? Invalid(GiveawayUpdate update)
    {
        if (string.IsNullOrWhiteSpace(update.Title)) return "The giveaway needs a name.";
        if (update.Title.Length > TitleMaxLength) return $"A reward name cannot be longer than {TitleMaxLength} characters.";
        if (update.Cost < 1) return "A reward has to cost at least 1 channel point.";
        if (update.Description?.Length > DescriptionMaxLength) return $"A reward description cannot be longer than {DescriptionMaxLength} characters.";
        if (update.BackgroundColor is not null && !HexColor().IsMatch(update.BackgroundColor)) return "A background color has to be a hex color like #9147FF.";
        if (update.CooldownSeconds is < 0 or > CooldownMaxSeconds) return $"A cooldown has to be between 0 and {CooldownMaxSeconds} seconds.";
        if (update.MaxPerStream is < 0) return "A per-stream limit cannot be negative.";
        if (update.MaxPerUserPerStream is < 0) return "A per-user limit cannot be negative.";

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

        if (twitchException.ResponseBody?.Contains("DUPLICATE_REWARD", StringComparison.OrdinalIgnoreCase) == true)
        {
            return BadRequest("A reward with this name already exists in your channel.");
        }

        var status = (int)twitchException.StatusCode;
        return status is >= 400 and < 500
            ? StatusCode(status)
            : StatusCode(StatusCodes.Status502BadGateway);
    }
}