namespace YEPPDash.Api.Data.Spotify;

public static class SpotifyLimits
{
    /// <summary>
    /// How many entries the dashboard and chat get to see. Spotify hands out twenty, but a queue
    /// preview is a glance, not a listing — and past the first handful it stops fitting in a chat
    /// message anyway.
    /// </summary>
    public const int QueueLength = 5;

    public const int MaxSearchResults = 10;

    /// <summary>
    /// A search term long enough to be a mistake. Spotify's own search stops being useful long
    /// before this, and a chat line cannot carry much more.
    /// </summary>
    public const int MaxRequestInputLength = 300;

    public const int DefaultCooldownSeconds = 60;

    public const int MaxCooldownSeconds = 3600;

    public const int DefaultMaxDurationMs = 600_000;

    /// <summary>
    /// An hour. Not a policy, only a guard: a max length past this is indistinguishable from "off",
    /// and the setting already has an off switch of its own.
    /// </summary>
    public const int MaxTrackDurationMs = 3_600_000;

    public const int MaxBlocklistReasonLength = 200;

    public const int HistoryPageSize = 50;
}
