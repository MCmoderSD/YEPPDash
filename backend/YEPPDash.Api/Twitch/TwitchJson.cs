using System.Text.Json;

namespace YEPPDash.Api.Twitch;

public static class TwitchJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };
}