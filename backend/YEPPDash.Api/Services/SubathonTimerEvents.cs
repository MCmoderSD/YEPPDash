using System.Text.Json;
using YEPPDash.Api.Data.SubathonTimer;

namespace YEPPDash.Api.Services;

public static class SubathonTimerEvents
{
    private static readonly JsonSerializerOptions EventJson = new(JsonSerializerDefaults.Web);

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
            EventJson);
    }
}