using System.Text.Json;
using YEPPDash.Api.Data.SubathonTimer;

namespace YEPPDash.Api.Services;

/// <summary>
/// What an overlay is sent. There is only one kind of message and it carries the whole state, so a
/// client renders from absolutes rather than deltas — which is why a dropped event costs nothing and
/// the hub's drop-oldest backlog is free to throw intermediate states away.
/// </summary>
/// <remarks>
/// Both the service and the watcher push these, so the shape is settled in one place: an overlay
/// that learned a command from chat must not receive something different from one that saw a click.
/// </remarks>
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
                ServerNow = serverNow,
            },
            EventJson);
    }
}
