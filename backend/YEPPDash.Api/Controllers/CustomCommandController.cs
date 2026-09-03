using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.CustomCommand;
using YEPPDash.Api.Exceptions.CustomCommand;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("commands")]
public sealed class CustomCommandController(
    CustomCommandService commands, ILogger<CustomCommandController> logger) : ControllerBase
{
    [HttpGet("{userId}")]
    public async Task<IActionResult> GetCommands(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        var found = await commands.GetAsync(userId, cancellationToken);
        return Ok(found.Select(CustomCommandResponse.From));
    }

    [HttpPost("{userId}")]
    public async Task<IActionResult> AddCommand(
        string userId, [FromBody] CustomCommandRequest request, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        try
        {
            var command = await commands.AddAsync(userId, request, cancellationToken);
            return CreatedAtAction(nameof(GetCommands), new { userId }, CustomCommandResponse.From(command));
        }
        catch (InvalidCustomCommandException exception)
        {
            return BadRequest(exception.Message);
        }
        catch (DuplicateCustomCommandException exception)
        {
            logger.LogInformation("Rejected command '{Trigger}' for {UserId}: already taken", exception.Trigger, userId);
            return Conflict(exception.Message);
        }
        catch (UnknownCustomCommandChannelException exception)
        {
            logger.LogWarning(exception, "Cannot add a command for channel {UserId}", userId);
            return Conflict("YEPPBot does not know this channel yet, so it cannot store commands for it.");
        }
    }

    [HttpPatch("{userId}/{name}")]
    public async Task<IActionResult> UpdateCommand(
        string userId, string name, [FromBody] CustomCommandRequest request, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        try
        {
            var command = await commands.UpdateAsync(userId, name, request, cancellationToken);
            return command is null ? NotFound() : Ok(CustomCommandResponse.From(command));
        }
        catch (InvalidCustomCommandException exception)
        {
            return BadRequest(exception.Message);
        }
        catch (DuplicateCustomCommandException exception)
        {
            logger.LogInformation("Rejected command '{Trigger}' for {UserId}: already taken", exception.Trigger, userId);
            return Conflict(exception.Message);
        }
        catch (UnknownCustomCommandChannelException exception)
        {
            logger.LogWarning(exception, "Cannot update a command for channel {UserId}", userId);
            return Conflict("YEPPBot does not know this channel yet, so it cannot store commands for it.");
        }
    }

    [HttpPatch("{userId}/{name}/active")]
    public async Task<IActionResult> SetActive(
        string userId,
        string name,
        [FromBody] CustomCommandActiveRequest request,
        CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        var command = await commands.SetActiveAsync(userId, name, request.Active, cancellationToken);
        return command is null ? NotFound() : Ok(CustomCommandResponse.From(command));
    }

    [HttpDelete("{userId}/{name}")]
    public async Task<IActionResult> DeleteCommand(string userId, string name, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        return await commands.DeleteAsync(userId, name, cancellationToken) ? NoContent() : NotFound();
    }

    private IActionResult? Denied(string userId)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (!string.Equals(twitchId, userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to reach the commands of channel {UserId}", twitchId, userId);
            return Forbid();
        }

        return null;
    }
}
