using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data.Spotify;

/// <summary>
/// Why a request did not make it into the queue, in a form the bot can branch on. These travel as
/// codes rather than finished sentences on purpose: the wording belongs to whatever is speaking —
/// German in chat, English on the dashboard — and neither should have to parse the other's prose.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<SongRequestReason>))]
public enum SongRequestReason
{
    [JsonStringEnumMemberName("COOLDOWN")]
    Cooldown,

    [JsonStringEnumMemberName("TOO_LONG")]
    TooLong,

    [JsonStringEnumMemberName("DUPLICATE")]
    Duplicate,

    [JsonStringEnumMemberName("BLOCKED")]
    Blocked,

    [JsonStringEnumMemberName("NOT_FOUND")]
    NotFound,

    [JsonStringEnumMemberName("NO_DEVICE")]
    NoDevice,

    [JsonStringEnumMemberName("NOT_CONNECTED")]
    NotConnected,

    [JsonStringEnumMemberName("PREMIUM_REQUIRED")]
    PremiumRequired,

    [JsonStringEnumMemberName("DISABLED")]
    Disabled,

    /// <summary>
    /// Spotify's queue happily takes podcast episodes, and a link to one looks exactly like a link
    /// to a track. Rejecting them is a guard, not a limitation of the queue.
    /// </summary>
    [JsonStringEnumMemberName("NOT_A_TRACK")]
    NotATrack,

    /// <summary>
    /// Only sent when the channel turned on "requests only while live" — otherwise the stream's
    /// state is never asked about.
    /// </summary>
    [JsonStringEnumMemberName("NOT_LIVE")]
    NotLive,

    [JsonStringEnumMemberName("RATE_LIMITED")]
    RateLimited
}
