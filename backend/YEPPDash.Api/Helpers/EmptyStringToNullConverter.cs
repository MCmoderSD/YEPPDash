using System.Text.Json;
using System.Text.Json.Serialization;

namespace YEPPDash.Api.Helpers;

// Twitch sends "" instead of omitting a field when it is unset (e.g. offline_image_url) —
// treat that the same as absent rather than forcing every consumer to check for both.
public sealed class EmptyStringToNullConverter : JsonConverter<string?>
{
    public override string? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetString();
        return string.IsNullOrEmpty(value) ? null : value;
    }

    public override void Write(Utf8JsonWriter writer, string? value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value);
    }
}
