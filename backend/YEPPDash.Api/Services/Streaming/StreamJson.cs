using System.Text.Json;

namespace YEPPDash.Api.Services.Streaming;

public static class StreamJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
}