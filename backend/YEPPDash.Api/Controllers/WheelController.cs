using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Wheel;
using YEPPDash.Api.Exceptions.Wheel;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;
using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("wheel")]
public sealed class WheelController(WheelService wheels, WheelHub hub, ILogger<WheelController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        return Ok(await wheels.ListAsync(twitchId, cancellationToken));
    }

    [HttpGet("count")]
    public async Task<IActionResult> Count(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        return Ok(await wheels.CountAsync(twitchId, cancellationToken));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        var wheel = await wheels.GetAsync(twitchId, id, cancellationToken);

        return wheel is null ? NotFound() : Ok(wheel);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] WheelUpdate update, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            return Ok(await wheels.CreateAsync(twitchId, update, cancellationToken));
        }
        catch (InvalidWheelException exception)
        {
            return BadRequest(exception.Message);
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Save(Guid id, [FromBody] WheelUpdate update, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            var wheel = await wheels.SaveAsync(twitchId, id, update, cancellationToken);

            return wheel is null ? NotFound() : Ok(wheel);
        }
        catch (InvalidWheelException exception)
        {
            return BadRequest(exception.Message);
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        return await wheels.DeleteAsync(twitchId, id, cancellationToken) ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/spin")]
    public IActionResult Spin(Guid id, [FromBody] WheelSpinRequest request)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (request.Index < 0) return BadRequest("A spin has to name the slice it landed on.");

        wheels.Spin(twitchId, id, request.Index);

        return NoContent();
    }

    [HttpPost("{id:guid}/dismiss")]
    public IActionResult Dismiss(Guid id)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        wheels.Dismiss(twitchId, id);

        return NoContent();
    }

    [AllowAnonymous]
    [HttpGet("overlay/{id:guid}")]
    public async Task<IActionResult> GetOverlay(Guid id, CancellationToken cancellationToken)
        => Ok(new WheelOverlayResponse(await wheels.OverlayAsync(id, cancellationToken)));

    [AllowAnonymous]
    [HttpGet("overlay/{id:guid}/stream")]
    public async Task OverlayStream(Guid id, CancellationToken cancellationToken)
    {
        var channelId = await wheels.ChannelOfAsync(id, cancellationToken);

        if (channelId is null)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        using var subscription = hub.Subscribe(channelId.Value, StreamAudience.Overlay);
        logger.LogDebug("An overlay is watching the wheel {WheelId} of channel {ChannelId}", id, channelId);

        await Response.StreamAsync(subscription, cancellationToken);

        logger.LogDebug("An overlay stopped watching the wheel {WheelId} of channel {ChannelId}", id, channelId);
    }
}