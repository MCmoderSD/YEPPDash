using Dapper;
using YEPPDash.Api.Data.Wheel;

namespace YEPPDash.Api.Repositories;

public sealed class WheelRepository(YeppDashConnectionFactory connections)
{
    public const string CreateTableSql =
        """
        CREATE TABLE IF NOT EXISTS Wheel
        (
            id      INT  NOT NULL PRIMARY KEY,
            entries TEXT NOT NULL DEFAULT ('')
        )
        """;

    public async Task<IReadOnlyList<string>?> GetAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var entries = await connection.QuerySingleOrDefaultAsync<string?>(
            new CommandDefinition(
                "SELECT entries FROM Wheel WHERE id = @channelId",
                new { channelId },
                cancellationToken: cancellationToken)
            );

        return entries is null ? null : Split(entries);
    }

    public async Task SaveAsync(int channelId, IReadOnlyList<string> entries, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                INSERT INTO Wheel (id, entries)
                VALUES (@channelId, @entries)
                ON DUPLICATE KEY UPDATE entries = @entries
                """,
                new { channelId, entries = Join(entries) },
                cancellationToken: cancellationToken)
            );
    }

    public async Task<bool> DeleteAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM Wheel WHERE id = @channelId",
                new { channelId },
                cancellationToken: cancellationToken)
            );

        return affected > 0;
    }

    private static string Join(IEnumerable<string> entries)
    {
        return string.Join(WheelLimits.Separator, entries);
    }

    private static IReadOnlyList<string> Split(string entries)
    {
        return entries.Split(WheelLimits.Separator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }
}