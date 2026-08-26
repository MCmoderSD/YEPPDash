using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data.Twitch;

// The body of Modify Channel Information. Null means "leave alone", which is why the nulls are not
// written: the endpoint changes exactly the fields the body carries, and sending `title: null` is a
// rejected value rather than an instruction to keep it.
//
// Clearing the game is therefore not null but "" — Twitch accepts "" or "0" for that, and there is
// no equivalent for the title, which may never be empty.
public sealed record ChannelUpdate
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Title { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? GameId { get; init; }

    // Replaces the whole list rather than adding to it, so clearing the tags is an empty array and
    // leaving them alone is null.
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<string>? Tags { get; init; }

    // Nullable on purpose: a plain bool would serialise as false when nobody touched it, and that
    // is an instruction to turn the flag off rather than to leave it be.
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? IsBrandedContent { get; init; }

    // ISO 639-1, or "other" for a language Twitch does not carry. An unsupported code is not an
    // error — Twitch simply leaves the field as it was, which is worth knowing before wondering why
    // a save reported success and changed nothing.
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? BroadcasterLanguage { get; init; }

    // Seconds, and partners only. Twitch refuses it for everyone else.
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Delay { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<ContentClassificationLabel>? ContentClassificationLabels { get; init; }
}
