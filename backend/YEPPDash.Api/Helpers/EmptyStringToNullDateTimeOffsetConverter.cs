using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace YEPPDash.Api.Helpers;

// Helix uses an empty string rather than null for "no timestamp" — a permanent ban has no
// expires_at, for example — which the built-in DateTimeOffset reader rejects outright.
public sealed class EmptyStringToNullDateTimeOffsetConverter : JsonConverter<DateTimeOffset?>
{
    public override DateTimeOffset? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType is JsonTokenType.Null) return null;

        var value = reader.GetString();
        return string.IsNullOrEmpty(value)
            ? null
            : DateTimeOffset.Parse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);
    }

    public override void Write(Utf8JsonWriter writer, DateTimeOffset? value, JsonSerializerOptions options)
    {
        if (value is null)
        {
            writer.WriteNullValue();
            return;
        }

        writer.WriteStringValue(value.Value);
    }
}
