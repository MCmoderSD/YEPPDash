using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Wheel;
using YEPPDash.Api.Exceptions.Wheel;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("wheel")]
public sealed class WheelController(
    WheelService wheels, WheelHub hub, ILogger<WheelController> logger) : ControllerBase
{
    private static readonly JsonSerializerOptions EventJson = new(JsonSerializerDefaults.Web);

    // Long enough to stay out of the way, short enough that no proxy or browser between here and
    // OBS takes an idle connection for a dead one.
    private static readonly TimeSpan KeepAlive = TimeSpan.FromSeconds(20);

    // Deliberately open: the overlay is a browser source in OBS, which carries no session at all.
    // The consequence is that knowing a channel id is enough to read that channel's entries — they
    // are names on a wheel meant to go out over a stream, not anything private, but it is a
    // decision rather than an oversight. Writing stays behind the session below.
    [AllowAnonymous]
    [HttpGet("{userId}")]
    public async Task<IActionResult> GetWheel(string userId, CancellationToken cancellationToken)
    {
        if (!int.TryParse(userId, out _)) return BadRequest("That is not a Twitch user ID.");

        var wheel = await wheels.GetAsync(userId, cancellationToken);
        return Ok(WheelResponse.From(wheel));
    }

    // The overlay holds this open for as long as it is on screen and is told about spins as they
    // happen. Open for the same reason the read above is: OBS has no session to offer.
    [AllowAnonymous]
    [HttpGet("{userId}/stream")]
    public async Task Stream(string userId, CancellationToken cancellationToken)
    {
        if (!int.TryParse(userId, out var channelId))
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache, no-store";

        // Nothing between here and OBS may sit on the events waiting for a buffer to fill.
        Response.Headers["X-Accel-Buffering"] = "no";

        using var subscription = hub.Subscribe(channelId);
        logger.LogDebug("An overlay is watching channel {ChannelId}", channelId);

        await WriteAsync(": connected\n\n", cancellationToken);

        while (!cancellationToken.IsCancellationRequested)
        {
            string payload;

            try
            {
                // Waits for the next event, but never for longer than the keep-alive: a silent
                // connection is one nothing can tell from a broken one.
                using var idle = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                idle.CancelAfter(KeepAlive);

                payload = await subscription.Reader.ReadAsync(idle.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                // A comment rather than an event: it keeps the connection warm without the overlay
                // having to know about it.
                await WriteAsync(": keep-alive\n\n", cancellationToken);
                continue;
            }
            catch (OperationCanceledException)
            {
                break;
            }

            await WriteAsync($"data: {payload}\n\n", cancellationToken);
        }

        logger.LogDebug("An overlay stopped watching channel {ChannelId}", channelId);
    }

    [HttpPut("{userId}")]
    public async Task<IActionResult> SaveWheel(
        string userId, [FromBody] WheelRequest request, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        try
        {
            var wheel = await wheels.SaveAsync(userId, request, cancellationToken);

            // Sent on rather than waited for: an overlay that only read the list when it opened
            // would show yesterday's names for the rest of the stream.
            Publish(userId, new { type = "state", entries = wheel.Entries });

            return Ok(WheelResponse.From(wheel));
        }
        catch (InvalidWheelException exception)
        {
            return BadRequest(exception.Message);
        }
    }

    // The slice is drawn by the dashboard and handed out, rather than each wheel drawing its own:
    // two wheels picking for themselves would stop on two different names.
    [HttpPost("{userId}/spin")]
    public IActionResult Spin(string userId, [FromBody] WheelSpinRequest request)
    {
        if (Denied(userId) is { } denied) return denied;
        if (request.Index < 0) return BadRequest("A spin has to name the slice it landed on.");

        Publish(userId, new { type = "spin", index = request.Index });

        return NoContent();
    }

    // The overlay has no controls of its own, so the streamer closing the winner on the dashboard is
    // what takes it off the stream.
    [HttpPost("{userId}/dismiss")]
    public IActionResult Dismiss(string userId)
    {
        if (Denied(userId) is { } denied) return denied;

        Publish(userId, new { type = "dismiss" });

        return NoContent();
    }

    [HttpDelete("{userId}")]
    public async Task<IActionResult> DeleteWheel(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        if (!await wheels.DeleteAsync(userId, cancellationToken)) return NotFound();

        Publish(userId, new { type = "state", entries = Array.Empty<string>() });

        return NoContent();
    }

    private void Publish(string userId, object payload)
    {
        if (int.TryParse(userId, out var channelId))
        {
            hub.Publish(channelId, JsonSerializer.Serialize(payload, EventJson));
        }
    }

    private async Task WriteAsync(string text, CancellationToken cancellationToken)
    {
        await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(text), cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }

    private IActionResult? Denied(string userId)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        // A session only ever speaks for its own channel — without this any logged-in user could
        // rewrite somebody else's wheel.
        if (!string.Equals(twitchId, userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to reach the wheel of channel {UserId}", twitchId, userId);
            return Forbid();
        }

        return null;
    }
}
