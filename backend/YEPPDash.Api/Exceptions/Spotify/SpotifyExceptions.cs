using YEPPDash.Api.Data.Spotify;

namespace YEPPDash.Api.Exceptions.Spotify;

/// <summary>
/// The base of everything the Spotify facade is allowed to throw. It exists so that controllers can
/// catch one type and map one property, instead of every caller learning which HTTP codes Spotify
/// answers with — that translation happens once, in <c>SpotifyPlaybackService</c>.
/// </summary>
public abstract class SpotifyException(SongRequestReason reason, string message) : Exception(message)
{
    public SongRequestReason Reason { get; } = reason;
}

/// <summary>
/// No Spotify credentials on this deployment at all. Distinct from "the broadcaster has not linked
/// an account": nobody can fix this one from the dashboard.
/// </summary>
public sealed class SpotifyNotConfiguredException()
    : SpotifyException(SongRequestReason.NotConnected, "This deployment has no Spotify credentials configured.");

public sealed class SpotifyNotConnectedException(int channelId)
    : SpotifyException(SongRequestReason.NotConnected, $"Channel {channelId} has not linked a Spotify account.");

/// <summary>
/// Spotify answered 403. Since February 2026 the <c>product</c> field is gone from <c>GET /me</c>,
/// so a missing Premium subscription cannot be checked for up front — it only ever shows up here.
/// </summary>
public sealed class SpotifyPremiumRequiredException()
    : SpotifyException(SongRequestReason.PremiumRequired, "Spotify refused the request — the account needs Premium for playback control.");

/// <summary>
/// Spotify answered 404 to a player call, which means no device is playing rather than no such
/// endpoint. The single most common failure in day-to-day use.
/// </summary>
public sealed class NoActiveDeviceException()
    : SpotifyException(SongRequestReason.NoDevice, "Spotify is not playing on any device right now.");

public sealed class SpotifyRateLimitedException(TimeSpan retryAfter)
    : SpotifyException(SongRequestReason.RateLimited, "Spotify is rate-limiting this channel.")
{
    public TimeSpan RetryAfter { get; } = retryAfter;
}

/// <summary>
/// A guard said no. Everything about it is already machine-readable, so nothing here needs reading
/// as prose.
/// </summary>
public sealed class SongRequestRejectedException(SongRequestReason reason, int? retryAfterSeconds = null)
    : SpotifyException(reason, $"The request was rejected: {reason}.")
{
    public int? RetryAfterSeconds { get; } = retryAfterSeconds;
}
