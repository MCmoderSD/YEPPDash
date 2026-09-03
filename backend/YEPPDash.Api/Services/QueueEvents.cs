using System.Text.Json;
using YEPPDash.Api.Data.Queue;

using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Services;

public static class QueueEvents
{
    public static string Serialize(QueueState state)
    {
        return JsonSerializer.Serialize(
            new
            {
                type = "state",
                state.IsOpen,
                state.Requirement,
                state.Entries
            },
            StreamJson.Options);
    }
}