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
public sealed class WheelController(WheelService wheels, WheelHub hub, ILogger<WheelController> logger) : ControllerBase
{
    private static readonly JsonSerializerOptions EventJson = new(JsonSerializerDefaults.Web);

    private static readonly TimeSpan KeepAlive = TimeSpan.FromSeconds(20);


    [AllowAnonymous]
    [HttpGet("{userId}")]
    public async Task<IActionResult> GetWheel(string userId, CancellationToken cancellationToken)
    {
        if (!int.TryParse(userId, out _)) return BadRequest("That is not a Twitch user ID.");

        var wheel = await wheels.GetAsync(userId, cancellationToken);
        return Ok(WheelResponse.From(wheel));
    }


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

        Response.Headers["X-Accel-Buffering"] = "no";

        using var subscription = hub.Subscribe(channelId);
        logger.LogDebug("An overlay is watching channel {ChannelId}", channelId);

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

        logger.LogDebug("An overlay stopped watching channel {ChannelId}", channelId);
    }

    [HttpPut("{userId}")]
    public async Task<IActionResult> SaveWheel(string userId, [FromBody] WheelRequest request, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        try
        {
            var wheel = await wheels.SaveAsync(userId, request, cancellationToken);

            Publish(userId, new { type = "state", entries = wheel.Entries });

            return Ok(WheelResponse.From(wheel));
        }
        catch (InvalidWheelException exception)
        {
            return BadRequest(exception.Message);
        }
    }

    [HttpPost("{userId}/spin")]
    public IActionResult Spin(string userId, [FromBody] WheelSpinRequest request)
    {
        if (Denied(userId) is { } denied) return denied;
        if (request.Index < 0) return BadRequest("A spin has to name the slice it landed on.");

        Publish(userId, new { type = "spin", index = request.Index });

        return NoContent();
    }

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

        if (!string.Equals(twitchId, userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to reach the wheel of channel {UserId}", twitchId, userId);
            return Forbid();
        }

        return null;
    }
}