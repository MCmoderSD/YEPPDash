namespace YEPPDash.Api.Data.Spotify;

public sealed record SpotifySettings(
    int ChannelId,
    bool RequestsEnabled,
    int CooldownSeconds,
    int MaxDurationMs,
    bool RequestsLiveOnly
)
{
    /// <summary>
    /// What a channel that has never opened the settings page runs on. Requests are on by default
    /// because a broadcaster who connected Spotify at all wanted them; the cooldown is what keeps
    /// that from being a mistake.
    /// </summary>
    public static SpotifySettings Default(int channelId)
    {
        return new SpotifySettings(
            channelId,
            RequestsEnabled: true,
            SpotifyLimits.DefaultCooldownSeconds,
            SpotifyLimits.DefaultMaxDurationMs,
            RequestsLiveOnly: false);
    }
}
