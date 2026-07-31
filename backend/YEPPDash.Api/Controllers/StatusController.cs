using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Controllers;

// Deliberately anonymous: this is what a reverse proxy or uptime monitor polls, and neither of
// those carries a session cookie.
[ApiController]
public sealed class StatusController(UptimeTracker uptime) : ControllerBase
{
    [HttpGet("uptime")]
    public ActionResult<UptimeResponse> GetUptime()
    {
        var elapsed = uptime.Elapsed;

        return new UptimeResponse(
            uptime.StartedAt,
            Math.Round(elapsed.TotalSeconds, 3),
            // Days stay separate from hours so a long-running instance does not read as "873:12:04".
            $"{elapsed.Days}d {elapsed.Hours:D2}h {elapsed.Minutes:D2}m {elapsed.Seconds:D2}s");
    }
}
