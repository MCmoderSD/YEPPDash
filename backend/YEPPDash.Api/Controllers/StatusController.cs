using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Controllers;

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
            $"{elapsed.Days}d {elapsed.Hours:D2}h {elapsed.Minutes:D2}m {elapsed.Seconds:D2}s");
    }
}