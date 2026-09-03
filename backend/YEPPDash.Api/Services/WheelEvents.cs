using System.Text.Json;
using YEPPDash.Api.Data.Wheel;
using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Services;

public static class WheelEvents
{
    public static string OverlayState(Guid wheelId, WheelOverlayState? wheel)
    {
        return JsonSerializer.Serialize(new { type = "state", wheelId, wheel }, StreamJson.Options);
    }

    public static string OverlaySpin(Guid wheelId, int index)
    {
        return JsonSerializer.Serialize(new { type = "spin", wheelId, index }, StreamJson.Options);
    }

    public static string OverlayDismiss(Guid wheelId)
    {
        return JsonSerializer.Serialize(new { type = "dismiss", wheelId }, StreamJson.Options);
    }
}