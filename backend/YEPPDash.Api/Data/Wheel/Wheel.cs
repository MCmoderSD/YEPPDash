using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data.Wheel;

// The same list of names drives more than one thing: a wheel that is spun, and a giveaway that is
// drawn. The mechanics are identical, so they share a table, a controller and a service, and this
// is what says which of them a row is.
//
// Carried over the wire by name rather than by position, so adding a type later cannot silently
// change what an older client thinks an existing one means.
[JsonConverter(typeof(JsonStringEnumConverter<WheelType>))]
public enum WheelType
{
    Wheel,
    Giveaway,
}

public static class WheelLimits
{
    public const int MaxEntryLength = 60;

    // A list this long is already past what can be drawn or read on a wheel, and it keeps the joined
    // column well inside what TEXT holds.
    public const int MaxEntries = 200;

    // Entries are stored as one column, so the character that joins them cannot appear inside one.
    public const char Separator = ',';
}

public sealed record Wheel(IReadOnlyList<string> Entries, WheelType Type);
