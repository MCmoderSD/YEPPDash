using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data.Spotify;

[JsonConverter(typeof(JsonStringEnumConverter<SpotifyBlocklistType>))]
public enum SpotifyBlocklistType
{
    Track,
    Artist
}

public sealed record SpotifyBlocklistEntry(
    long Id,
    int ChannelId,
    SpotifyBlocklistType EntryType,
    string EntryId,
    string Name,
    string? Reason
);
