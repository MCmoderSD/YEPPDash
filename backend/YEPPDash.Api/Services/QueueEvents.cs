using System.Text.Json;
using YEPPDash.Api.Data.Queue;

namespace YEPPDash.Api.Services;

public static class QueueEvents
{
    private static readonly JsonSerializerOptions EventJson = new(JsonSerializerDefaults.Web);

    public static string Serialize(QueueState state)
    {
        return JsonSerializer.Serialize(
            new
            {
                type = "state",
                state.IsOpen,
                state.Requirement,
                state.Entries,
            },
            EventJson);
    }
}