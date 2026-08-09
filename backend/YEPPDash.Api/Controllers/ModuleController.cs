using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Module;
using YEPPDash.Api.Exceptions.Module;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("modules")]
public sealed class ModuleController(
    ModuleService modules, ILogger<ModuleController> logger) : ControllerBase
{
    [HttpGet("{userId}")]
    public async Task<IActionResult> GetModules(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        var found = await modules.GetAsync(userId, cancellationToken);
        return Ok(found.Select(state => BotModuleResponse.From(state.Module, state.Enabled)));
    }

    [HttpPost("{userId}/{moduleId}/enable")]
    public Task<IActionResult> EnableModule(string userId, string moduleId, CancellationToken cancellationToken)
    {
        return SetEnabled(userId, moduleId, enabled: true, cancellationToken);
    }

    [HttpPost("{userId}/{moduleId}/disable")]
    public Task<IActionResult> DisableModule(string userId, string moduleId, CancellationToken cancellationToken)
    {
        return SetEnabled(userId, moduleId, enabled: false, cancellationToken);
    }

    private async Task<IActionResult> SetEnabled(
        string userId, string moduleId, bool enabled, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        try
        {
            var state = await modules.SetEnabledAsync(userId, moduleId, enabled, cancellationToken);
            return state is null ? NotFound() : Ok(BotModuleResponse.From(state.Module, state.Enabled));
        }
        catch (UnknownModuleChannelException exception)
        {
            logger.LogWarning(exception, "Cannot change a module for channel {UserId}", userId);
            return Conflict("YEPPBot has not joined this channel yet, so it cannot store modules for it.");
        }
    }

    private IActionResult? Denied(string userId)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        // Modules belong to a channel, and a session only ever speaks for its own — without this any
        // logged-in user could switch off somebody else's commands.
        if (!string.Equals(twitchId, userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to reach the modules of channel {UserId}", twitchId, userId);
            return Forbid();
        }

        return null;
    }
}
