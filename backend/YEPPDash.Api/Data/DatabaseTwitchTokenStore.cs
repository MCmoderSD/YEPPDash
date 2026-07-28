using Dapper;
using YEPPDash.Api.Auth;

namespace YEPPDash.Api.Data;

public sealed class DatabaseTwitchTokenStore(YeppDashConnectionFactory connections, ITokenCipher cipher)
    : ITwitchTokenStore
{
    public const string CreateTableSql =
        """
        CREATE TABLE IF NOT EXISTS TwitchToken
        (
            userId       INT       NOT NULL PRIMARY KEY,
            accessToken  TEXT      NOT NULL,
            refreshToken TEXT      NOT NULL,
            scopes       TEXT      NOT NULL,
            expiresAt    DATETIME  NOT NULL,
            updatedAt    DATETIME  NOT NULL
        )
        """;

    public async Task<StoredTwitchToken?> GetAsync(string twitchUserId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var row = await connection.QuerySingleOrDefaultAsync<TokenRow>(
            new CommandDefinition(
                "SELECT userId, accessToken, refreshToken, scopes, expiresAt FROM TwitchToken WHERE userId = @userId",
                new { userId = ParseUserId(twitchUserId) },
                cancellationToken: cancellationToken));

        if (row is null) return null;

        return new StoredTwitchToken(
            row.UserId.ToString(),
            cipher.Unprotect(row.AccessToken),
            cipher.Unprotect(row.RefreshToken),
            row.Scopes.Split(' ', StringSplitOptions.RemoveEmptyEntries),
            new DateTimeOffset(DateTime.SpecifyKind(row.ExpiresAt, DateTimeKind.Utc)));
    }

    public async Task SaveAsync(StoredTwitchToken token, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var parameters = new
        {
            userId = ParseUserId(token.TwitchUserId),
            accessToken = cipher.Protect(token.AccessToken),
            refreshToken = cipher.Protect(token.RefreshToken),
            scopes = string.Join(' ', token.Scopes),
            expiresAt = token.ExpiresAt.UtcDateTime,
            updatedAt = DateTime.UtcNow
        };

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                INSERT INTO TwitchToken (userId, accessToken, refreshToken, scopes, expiresAt, updatedAt)
                VALUES (@userId, @accessToken, @refreshToken, @scopes, @expiresAt, @updatedAt)
                ON DUPLICATE KEY UPDATE
                    accessToken  = @accessToken,
                    refreshToken = @refreshToken,
                    scopes       = @scopes,
                    expiresAt    = @expiresAt,
                    updatedAt    = @updatedAt
                """,
                parameters,
                cancellationToken: cancellationToken));
    }

    public async Task DeleteAsync(string twitchUserId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM TwitchToken WHERE userId = @userId",
                new { userId = ParseUserId(twitchUserId) },
                cancellationToken: cancellationToken));
    }

    private static int ParseUserId(string twitchUserId)
    {
        if (!int.TryParse(twitchUserId, out var id))
        {
            throw new ArgumentException($"'{twitchUserId}' is not a numeric Twitch user ID.", nameof(twitchUserId));
        }

        return id;
    }

    private sealed class TokenRow
    {
        public int UserId { get; init; }
        public string AccessToken { get; init; } = "";
        public string RefreshToken { get; init; } = "";
        public string Scopes { get; init; } = "";
        public DateTime ExpiresAt { get; init; }
    }
}
