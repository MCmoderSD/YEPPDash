using Dapper;
using YEPPDash.Api.Auth;
using YEPPDash.Api.Data.Spotify;

namespace YEPPDash.Api.Repositories;

/// <summary>
/// Everything Spotify keeps on disk. These tables belong to YEPPDash rather than to the helix schema
/// the subathon timer shares with the bot: YEPPBot never reads them — it goes through the internal
/// HTTP API — so there is no second writer to agree with, and no reason to migrate someone else's
/// database. That is also why nothing here has a foreign key to <c>channel</c>: that table lives in
/// the other schema, and MariaDB cannot reference across one.
/// </summary>
public sealed class SpotifyRepository(YeppDashConnectionFactory connections, ITokenCipher cipher)
{
    public static readonly string[] CreateTableSql =
    [
        """
        CREATE TABLE IF NOT EXISTS SpotifyConnection
        (
            channelId     INT          NOT NULL PRIMARY KEY,
            spotifyUserId VARCHAR(64)  NOT NULL,
            displayName   VARCHAR(128) NOT NULL DEFAULT (''),
            refreshToken  TEXT         NOT NULL,
            accessToken   TEXT             NULL,
            expiresAt     DATETIME         NULL,
            connectedAt   DATETIME     NOT NULL,
            status        VARCHAR(16)  NOT NULL DEFAULT ('Connected')
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS SpotifySettings
        (
            channelId        INT    NOT NULL PRIMARY KEY,
            requestsEnabled  BIT(1) NOT NULL DEFAULT b'1',
            cooldownSeconds  INT    NOT NULL DEFAULT 60,
            maxDurationMs    INT    NOT NULL DEFAULT 600000,
            requestsLiveOnly BIT(1) NOT NULL DEFAULT b'0'
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS SpotifyBlocklist
        (
            id        BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
            channelId INT          NOT NULL,
            entryType VARCHAR(8)   NOT NULL,
            entryId   VARCHAR(64)  NOT NULL,
            name      VARCHAR(256) NOT NULL DEFAULT (''),
            reason    VARCHAR(200)     NULL,
            UNIQUE KEY uqSpotifyBlocklistEntry (channelId, entryType, entryId)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS SongRequest
        (
            id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
            channelId       INT          NOT NULL,
            trackId         VARCHAR(64)  NOT NULL,
            trackName       VARCHAR(256) NOT NULL,
            artists         VARCHAR(512) NOT NULL,
            durationMs      INT          NOT NULL,
            requestedBy     VARCHAR(32)  NOT NULL,
            requestedByName VARCHAR(64)  NOT NULL,
            requestedAt     DATETIME     NOT NULL,
            source          VARCHAR(16)  NOT NULL,
            KEY ixSongRequestChannel (channelId, requestedAt),
            KEY ixSongRequestTrack (channelId, trackId)
        )
        """
    ];

    #region Connection

    public async Task<SpotifyConnection?> GetConnectionAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var row = await connection.QuerySingleOrDefaultAsync<ConnectionRow>(
            new CommandDefinition(
                """
                SELECT channelId, spotifyUserId, displayName, refreshToken, accessToken, expiresAt, connectedAt, status
                  FROM SpotifyConnection
                 WHERE channelId = @channelId
                """,
                new { channelId },
                cancellationToken: cancellationToken));

        return row?.ToConnection(cipher);
    }

    public async Task SaveConnectionAsync(SpotifyConnection link, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var parameters = new
        {
            channelId = link.ChannelId,
            spotifyUserId = link.SpotifyUserId,
            displayName = link.DisplayName,
            refreshToken = cipher.Protect(link.RefreshToken),
            accessToken = link.AccessToken is null ? null : cipher.Protect(link.AccessToken),
            expiresAt = link.ExpiresAt,
            connectedAt = link.ConnectedAt,
            status = link.Status.ToString()
        };

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                INSERT INTO SpotifyConnection
                    (channelId, spotifyUserId, displayName, refreshToken, accessToken, expiresAt, connectedAt, status)
                VALUES
                    (@channelId, @spotifyUserId, @displayName, @refreshToken, @accessToken, @expiresAt, @connectedAt, @status)
                ON DUPLICATE KEY UPDATE
                    spotifyUserId = @spotifyUserId,
                    displayName   = @displayName,
                    refreshToken  = @refreshToken,
                    accessToken   = @accessToken,
                    expiresAt     = @expiresAt,
                    connectedAt   = @connectedAt,
                    status        = @status
                """,
                parameters,
                cancellationToken: cancellationToken));
    }

    /// <summary>
    /// Writes back what the library handed us after a refresh. Spotify may rotate the refresh token
    /// on any refresh, and without this the whole channel would be running on a token that exists
    /// only in process memory — working perfectly until the next restart.
    /// </summary>
    public async Task SaveTokensAsync(
        int channelId, string refreshToken, string accessToken, DateTime expiresAt, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                UPDATE SpotifyConnection
                   SET refreshToken = @refreshToken,
                       accessToken  = @accessToken,
                       expiresAt    = @expiresAt,
                       status       = 'Connected'
                 WHERE channelId = @channelId
                """,
                new
                {
                    channelId,
                    refreshToken = cipher.Protect(refreshToken),
                    accessToken = cipher.Protect(accessToken),
                    expiresAt
                },
                cancellationToken: cancellationToken));
    }

    public async Task SetStatusAsync(int channelId, SpotifyConnectionStatus status, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE SpotifyConnection SET status = @status WHERE channelId = @channelId",
                new { channelId, status = status.ToString() },
                cancellationToken: cancellationToken));
    }

    public async Task<bool> DeleteConnectionAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM SpotifyConnection WHERE channelId = @channelId",
                new { channelId },
                cancellationToken: cancellationToken));

        return affected > 0;
    }

    #endregion

    #region Settings

    public async Task<SpotifySettings> GetSettingsAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var row = await connection.QuerySingleOrDefaultAsync<SettingsRow>(
            new CommandDefinition(
                """
                SELECT channelId, requestsEnabled, cooldownSeconds, maxDurationMs, requestsLiveOnly
                  FROM SpotifySettings
                 WHERE channelId = @channelId
                """,
                new { channelId },
                cancellationToken: cancellationToken));

        return row?.ToSettings() ?? SpotifySettings.Default(channelId);
    }

    public async Task SaveSettingsAsync(SpotifySettings settings, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                INSERT INTO SpotifySettings
                    (channelId, requestsEnabled, cooldownSeconds, maxDurationMs, requestsLiveOnly)
                VALUES
                    (@ChannelId, @RequestsEnabled, @CooldownSeconds, @MaxDurationMs, @RequestsLiveOnly)
                ON DUPLICATE KEY UPDATE
                    requestsEnabled  = @RequestsEnabled,
                    cooldownSeconds  = @CooldownSeconds,
                    maxDurationMs    = @MaxDurationMs,
                    requestsLiveOnly = @RequestsLiveOnly
                """,
                settings,
                cancellationToken: cancellationToken));
    }

    #endregion

    #region Blocklist

    public async Task<IReadOnlyList<SpotifyBlocklistEntry>> GetBlocklistAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<BlocklistRow>(
            new CommandDefinition(
                """
                SELECT id, channelId, entryType, entryId, name, reason
                  FROM SpotifyBlocklist
                 WHERE channelId = @channelId
                 ORDER BY entryType, name
                """,
                new { channelId },
                cancellationToken: cancellationToken));

        return [.. rows.Select(row => row.ToEntry())];
    }

    public async Task AddBlockAsync(
        int channelId, SpotifyBlocklistType entryType, string entryId, string name, string? reason,
        CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                INSERT INTO SpotifyBlocklist (channelId, entryType, entryId, name, reason)
                VALUES (@channelId, @entryType, @entryId, @name, @reason)
                ON DUPLICATE KEY UPDATE name = @name, reason = @reason
                """,
                new { channelId, entryType = entryType.ToString(), entryId, name, reason },
                cancellationToken: cancellationToken));
    }

    public async Task<bool> RemoveBlockAsync(int channelId, long id, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM SpotifyBlocklist WHERE channelId = @channelId AND id = @id",
                new { channelId, id },
                cancellationToken: cancellationToken));

        return affected > 0;
    }

    #endregion

    #region Request log

    public async Task LogRequestAsync(
        int channelId, SpotifyTrack track, string requestedBy, string requestedByName, SongRequestSource source,
        CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                INSERT INTO SongRequest
                    (channelId, trackId, trackName, artists, durationMs, requestedBy, requestedByName, requestedAt, source)
                VALUES
                    (@channelId, @trackId, @trackName, @artists, @durationMs, @requestedBy, @requestedByName, @requestedAt, @source)
                """,
                new
                {
                    channelId,
                    trackId = track.Id,
                    trackName = track.Name,
                    artists = track.Artists,
                    durationMs = track.DurationMs,
                    requestedBy,
                    requestedByName,
                    requestedAt = DateTime.UtcNow,
                    source = source.ToString()
                },
                cancellationToken: cancellationToken));
    }

    /// <summary>
    /// When this user last got a track through. Only successful requests are logged, so a rejected
    /// one never starts a cooldown — being told to wait would otherwise cost the same as succeeding.
    /// </summary>
    public async Task<DateTime?> GetLastRequestAtAsync(int channelId, string requestedBy, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var last = await connection.QuerySingleOrDefaultAsync<DateTime?>(
            new CommandDefinition(
                """
                SELECT MAX(requestedAt) FROM SongRequest
                 WHERE channelId = @channelId AND requestedBy = @requestedBy
                """,
                new { channelId, requestedBy },
                cancellationToken: cancellationToken));

        return last is null ? null : DateTime.SpecifyKind(last.Value, DateTimeKind.Utc);
    }

    /// <summary>
    /// Who asked for each of these tracks, most recent request winning. Used to put a name next to a
    /// queue entry; tracks the broadcaster queued in Spotify themselves are simply absent.
    /// </summary>
    public async Task<IReadOnlyDictionary<string, string>> GetRequestersAsync(
        int channelId, IReadOnlyCollection<string> trackIds, CancellationToken cancellationToken)
    {
        if (trackIds.Count is 0) return new Dictionary<string, string>();

        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<RequesterRow>(
            new CommandDefinition(
                """
                SELECT trackId, requestedByName, requestedAt
                  FROM SongRequest
                 WHERE channelId = @channelId AND trackId IN @trackIds
                 ORDER BY requestedAt
                """,
                new { channelId, trackIds },
                cancellationToken: cancellationToken));

        var requesters = new Dictionary<string, string>();
        foreach (var row in rows) requesters[row.TrackId] = row.RequestedByName;

        return requesters;
    }

    public async Task<IReadOnlyList<SongRequest>> GetHistoryAsync(
        int channelId, string? requestedBy, int limit, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<RequestRow>(
            new CommandDefinition(
                """
                SELECT id, channelId, trackId, trackName, artists, durationMs,
                       requestedBy, requestedByName, requestedAt, source
                  FROM SongRequest
                 WHERE channelId = @channelId
                   AND (@requestedBy IS NULL OR requestedBy = @requestedBy)
                 ORDER BY requestedAt DESC
                 LIMIT @limit
                """,
                new { channelId, requestedBy, limit },
                cancellationToken: cancellationToken));

        return [.. rows.Select(row => row.ToRequest())];
    }

    #endregion

    private sealed class ConnectionRow
    {
        public int ChannelId { get; init; }
        public string SpotifyUserId { get; init; } = string.Empty;
        public string DisplayName { get; init; } = string.Empty;
        public string RefreshToken { get; init; } = string.Empty;
        public string? AccessToken { get; init; }
        public DateTime? ExpiresAt { get; init; }
        public DateTime ConnectedAt { get; init; }
        public string Status { get; init; } = nameof(SpotifyConnectionStatus.Connected);

        public SpotifyConnection ToConnection(ITokenCipher cipher)
        {
            return new SpotifyConnection(
                ChannelId,
                SpotifyUserId,
                DisplayName,
                cipher.Unprotect(RefreshToken),
                AccessToken is null ? null : cipher.Unprotect(AccessToken),
                Utc(ExpiresAt),
                DateTime.SpecifyKind(ConnectedAt, DateTimeKind.Utc),
                Enum.TryParse<SpotifyConnectionStatus>(Status, out var status) ? status : SpotifyConnectionStatus.Error);
        }
    }

    private sealed class SettingsRow
    {
        public int ChannelId { get; init; }
        public bool RequestsEnabled { get; init; }
        public int CooldownSeconds { get; init; }
        public int MaxDurationMs { get; init; }
        public bool RequestsLiveOnly { get; init; }

        public SpotifySettings ToSettings()
        {
            return new SpotifySettings(ChannelId, RequestsEnabled, CooldownSeconds, MaxDurationMs, RequestsLiveOnly);
        }
    }

    private sealed class BlocklistRow
    {
        public long Id { get; init; }
        public int ChannelId { get; init; }
        public string EntryType { get; init; } = nameof(SpotifyBlocklistType.Track);
        public string EntryId { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string? Reason { get; init; }

        public SpotifyBlocklistEntry ToEntry()
        {
            return new SpotifyBlocklistEntry(
                Id,
                ChannelId,
                Enum.TryParse<SpotifyBlocklistType>(EntryType, out var type) ? type : SpotifyBlocklistType.Track,
                EntryId,
                Name,
                Reason);
        }
    }

    private sealed class RequesterRow
    {
        public string TrackId { get; init; } = string.Empty;
        public string RequestedByName { get; init; } = string.Empty;
        public DateTime RequestedAt { get; init; }
    }

    private sealed class RequestRow
    {
        public long Id { get; init; }
        public int ChannelId { get; init; }
        public string TrackId { get; init; } = string.Empty;
        public string TrackName { get; init; } = string.Empty;
        public string Artists { get; init; } = string.Empty;
        public int DurationMs { get; init; }
        public string RequestedBy { get; init; } = string.Empty;
        public string RequestedByName { get; init; } = string.Empty;
        public DateTime RequestedAt { get; init; }
        public string Source { get; init; } = nameof(SongRequestSource.Chat);

        public SongRequest ToRequest()
        {
            return new SongRequest(
                Id, ChannelId, TrackId, TrackName, Artists, DurationMs, RequestedBy, RequestedByName,
                DateTime.SpecifyKind(RequestedAt, DateTimeKind.Utc),
                Enum.TryParse<SongRequestSource>(Source, out var source) ? source : SongRequestSource.Chat);
        }
    }

    private static DateTime? Utc(DateTime? value)
    {
        return value is null ? null : DateTime.SpecifyKind(value.Value, DateTimeKind.Utc);
    }
}
