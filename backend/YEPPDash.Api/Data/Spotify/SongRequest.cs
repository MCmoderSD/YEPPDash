using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data.Spotify;

[JsonConverter(typeof(JsonStringEnumConverter<SongRequestSource>))]
public enum SongRequestSource
{
    Chat,
    Dashboard
}

/// <summary>
/// One line of the request log. This is not a queue — Spotify owns the queue, and there is no
/// endpoint to take anything back out of it. What this is for is attribution ("von @user" next to a
/// queued track), cooldowns, and duplicate detection.
/// </summary>
public sealed record SongRequest(
    long Id,
    int ChannelId,
    string TrackId,
    string TrackName,
    string Artists,
    int DurationMs,
    string RequestedBy,
    string RequestedByName,
    DateTime RequestedAt,
    SongRequestSource Source
);
