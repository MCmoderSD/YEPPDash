namespace YEPPDash.Api.Data.Spotify;

/// <summary>
/// A song request as it arrives: raw text, exactly as it was typed. Deciding whether that is a
/// link, a URI or something to search for happens in one place, and this is not it — the bot parses
/// nothing, so a new link format is a change here and nowhere else.
/// </summary>
public sealed record SongRequestInput
{
    public string Input { get; init; } = string.Empty;

    public string TwitchUserId { get; init; } = string.Empty;

    public string TwitchUserName { get; init; } = string.Empty;
}

public sealed record SpotifySettingsRequest
{
    public bool RequestsEnabled { get; init; }

    public int CooldownSeconds { get; init; }

    public int MaxDurationMs { get; init; }

    public bool RequestsLiveOnly { get; init; }
}

public sealed record SpotifyBlocklistRequest
{
    public SpotifyBlocklistType EntryType { get; init; }

    public string EntryId { get; init; } = string.Empty;

    public string Name { get; init; } = string.Empty;

    public string? Reason { get; init; }
}
