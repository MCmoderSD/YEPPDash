using Dapper;
using YEPPDash.Api.Data.Wheel;

namespace YEPPDash.Api.Repositories;

// Lives in the YEPPDash database rather than YEPPBot's, which is what lets it stand on its own: the
// id is a Twitch user id but nothing points at a user row, so a wheel can exist for a channel the
// bot has never seen.
public sealed class WheelRepository(YeppDashConnectionFactory connections)
{
    public const string CreateTableSql =
        """
        CREATE TABLE IF NOT EXISTS Wheel
        (
            id      INT                       NOT NULL PRIMARY KEY,
            entries TEXT                      NOT NULL DEFAULT (''),
            type    ENUM('wheel', 'giveaway') NOT NULL DEFAULT 'wheel'
        )
        """;

    public async Task<Data.Wheel.Wheel?> GetAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var row = await connection.QuerySingleOrDefaultAsync<WheelRow>(
            new CommandDefinition(
                "SELECT entries, type FROM Wheel WHERE id = @channelId",
                new { channelId },
                cancellationToken: cancellationToken));

        if (row is null) return null;

        return new Data.Wheel.Wheel(
            Split(row.Entries),
            // A type the column allows but this app does not know yet reads as a wheel rather than
            // throwing: one unfamiliar row should not take the page down with it.
            Enum.TryParse<WheelType>(row.Type, ignoreCase: true, out var type) ? type : WheelType.Wheel);
    }

    public async Task SaveAsync(
        int channelId, IReadOnlyList<string> entries, WheelType type, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                INSERT INTO Wheel (id, entries, type)
                VALUES (@channelId, @entries, @type)
                ON DUPLICATE KEY UPDATE entries = @entries, type = @type
                """,
                new { channelId, entries = Join(entries), type = type.ToString().ToLowerInvariant() },
                cancellationToken: cancellationToken));
    }

    public async Task<bool> DeleteAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM Wheel WHERE id = @channelId",
                new { channelId },
                cancellationToken: cancellationToken));

        return affected > 0;
    }

    public static string Join(IEnumerable<string> entries)
    {
        return string.Join(WheelLimits.Separator, entries);
    }

    // Empty entries are dropped rather than kept as blanks: an empty column splits into one empty
    // string, which is a wheel with a nameless slice on it.
    public static IReadOnlyList<string> Split(string entries)
    {
        return entries.Split(
            WheelLimits.Separator,
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    private sealed class WheelRow
    {
        public string Entries { get; init; } = "";
        public string Type { get; init; } = "";
    }
}
