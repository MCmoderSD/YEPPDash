using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Queue;
using YEPPDash.Api.Exceptions.Queue;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;
using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("queue")]
public sealed class QueueController(
    QueueService queues,
    QueueHub hub,
    ILogger<QueueController> logger) : ControllerBase
{
    [HttpGet("{userId}")]
    public async Task<IActionResult> GetQueue(string userId, CancellationToken cancellationToken)
    {
        if (!int.TryParse(userId, out _)) return BadRequest("That is not a Twitch user ID.");
        if (Denied(userId) is { } denied) return denied;

        return Ok(QueueResponse.From(await queues.GetAsync(userId, cancellationToken)));
    }

    [HttpGet("{userId}/stream")]
    public async Task Stream(string userId, CancellationToken cancellationToken)
    {
        if (!int.TryParse(userId, out var channelId))
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        if (!string.Equals(User.GetTwitchId(), userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to watch the queue of the channel {UserId}", User.GetTwitchId(), LogSafe.OneLine(userId));
            Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        using var subscription = hub.Subscribe(channelId);
        logger.LogDebug("A dashboard is watching the queue of the channel {ChannelId}", channelId);

        await Response.StreamAsync(subscription, cancellationToken);

        logger.LogDebug("A dashboard stopped watching the queue of the channel {ChannelId}", channelId);
    }

    [HttpPost("{userId}/open")]
    public Task<IActionResult> Open(string userId, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => queues.OpenAsync(userId, token), cancellationToken);
    }

    [HttpPost("{userId}/close")]
    public Task<IActionResult> Close(string userId, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => queues.CloseAsync(userId, token), cancellationToken);
    }

    [HttpPost("{userId}/next")]
    public Task<IActionResult> Next(string userId, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => queues.NextAsync(userId, token), cancellationToken);
    }

    [HttpDelete("{userId}/entries")]
    public Task<IActionResult> Clear(string userId, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => queues.ClearAsync(userId, token), cancellationToken);
    }

    [HttpDelete("{userId}/entries/{entryId}")]
    public Task<IActionResult> Remove(string userId, string entryId, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => queues.RemoveAsync(userId, entryId, token), cancellationToken);
    }

    [HttpPut("{userId}/entries/{entryId}/position")]
    public Task<IActionResult> Move(string userId, string entryId, [FromBody] QueuePositionRequest request, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => queues.MoveAsync(userId, entryId, request.Position, token), cancellationToken);
    }

    [HttpPut("{userId}/requirement")]
    public Task<IActionResult> SaveRequirement(string userId, [FromBody] QueueRequirementRequest request, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, token => queues.SaveRequirementAsync(userId, request.Requirement, token), cancellationToken);
    }

    private async Task<IActionResult> CommandAsync(string userId, Func<CancellationToken, Task<QueueState>> command, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        try
        {
            return Ok(QueueResponse.From(await command(cancellationToken)));
        }
        catch (InvalidQueueException exception)
        {
            return BadRequest(exception.Message);
        }
    }

    private IActionResult? Denied(string userId)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (!string.Equals(twitchId, userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to reach the queue of the channel {UserId}", twitchId, LogSafe.OneLine(userId));
            return Forbid();
        }

        return null;
    }
}