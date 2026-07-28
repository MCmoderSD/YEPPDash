using System.Text.Json;

namespace YEPPDash.Api.Twitch;

public static class TwitchJson
{
    // Twitch speaks snake_case, our own API speaks camelCase (ASP.NET's web defaults). Keeping that
    // difference here rather than in [JsonPropertyName] attributes on the records is what lets the
    // same record be read from Twitch and written to the frontend: attributes apply to both
    // directions, so they would force Twitch's naming onto our own responses too.
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };
}
