using System.Text.Json;
using YEPPDash.Api.Data.SubathonTimer;

using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Services;

public static class SubathonTimerEvents
{
    public static string Serialize(SubathonTimerState state, DateTime serverNow)
    {
        return JsonSerializer.Serialize(
            new
            {
                type = "state",
                state.Running,
                state.EndsAt,
                state.Remaining,
                state.StartSeconds,
                state.Style,
                ServerNow = serverNow
            },
            StreamJson.Options);
    }
}