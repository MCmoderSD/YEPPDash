using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Shoutout;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

// No channel id in the route: the settings a session may read or change are its own, and taking the
// id from the cookie leaves nothing to guard against.
[ApiController]
[Authorize]
[Route("shoutout")]
public sealed class ShoutoutController(ShoutoutService shoutouts) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetSettings(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        var settings = await shoutouts.GetAsync(twitchId, cancellationToken);

        return settings is null ? NotFound() : Ok(ShoutoutResponse.From(settings));
    }

    // Takes the value it should end on rather than flipping what it finds, so a double click cannot
    // land back where it started and the answer always matches what the switch was moved to.
    [HttpPatch("auto")]
    public async Task<IActionResult> SetAutoShoutout([FromBody] ShoutoutRequest request, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        var settings = await shoutouts.SetAutoShoutoutAsync(twitchId, request.AutoShoutout, cancellationToken);

        return settings is null ? NotFound() : Ok(ShoutoutResponse.From(settings));
    }
}