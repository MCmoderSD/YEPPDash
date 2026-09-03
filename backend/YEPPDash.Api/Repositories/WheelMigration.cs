using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data.Wheel;

namespace YEPPDash.Api.Repositories;

public static class WheelMigration
{
    private const char Separator = ',';

    private const string DefaultName = "Lucky Wheel";

    private const string InsertWheelSql =
        "INSERT INTO Wheels (id, channelId, name, updatedAt) VALUES (@id, @channelId, @name, @updatedAt)";

    private const string InsertEntrySql =
        "INSERT INTO WheelEntries (wheelId, position, label, slices) VALUES (@wheelId, @position, @label, @slices)";

    public static async Task<int> RunAsync(MySqlConnection connection)
    {
        var moved = 0;

        if (await ExistsAsync(connection, "LuckyWheel")) moved += await MoveNamedAsync(connection);
        if (await ExistsAsync(connection, "Wheel")) moved += await MoveUnnamedAsync(connection);

        return moved;
    }

    private static async Task<bool> ExistsAsync(MySqlConnection connection, string table)
    {
        return await connection.ExecuteScalarAsync<int>(
            """
            SELECT COUNT(*)
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @table
            """,
            new { table }) > 0;
    }

    private static async Task<int> MoveNamedAsync(MySqlConnection connection)
    {
        var rows = (await connection.QueryAsync<NamedRow>("SELECT id, channelId, name, entries, updatedAt FROM LuckyWheel")).ToArray();

        if (rows.Length is 0) return 0;

        await using var transaction = await Begin(connection);

        foreach (var row in rows)
        {
            await WriteAsync(connection, transaction, row.Id, row.ChannelId, row.Name, row.UpdatedAt, row.Entries);
        }

        await connection.ExecuteAsync("DELETE FROM LuckyWheel", transaction: transaction);
        await transaction.CommitAsync();

        return rows.Length;
    }

    private static async Task<int> MoveUnnamedAsync(MySqlConnection connection)
    {
        var rows = (await connection.QueryAsync<UnnamedRow>("SELECT id, entries FROM Wheel")).ToArray();

        if (rows.Length is 0) return 0;

        await using var transaction = await Begin(connection);

        foreach (var row in rows)
        {
            await WriteAsync(connection, transaction, Guid.NewGuid(), row.Id, DefaultName, DateTime.UtcNow, row.Entries);
        }

        await connection.ExecuteAsync("DELETE FROM Wheel", transaction: transaction);
        await transaction.CommitAsync();

        return rows.Length;
    }

    private static async Task<MySqlTransaction> Begin(MySqlConnection connection)
    {
        if (connection.State is not System.Data.ConnectionState.Open) await connection.OpenAsync();

        return await connection.BeginTransactionAsync();
    }

    private static async Task WriteAsync(
        MySqlConnection connection,
        MySqlTransaction transaction,
        Guid id,
        int channelId,
        string? name,
        DateTime updatedAt,
        string? entries)
    {
        await connection.ExecuteAsync(
            InsertWheelSql,
            new
            {
                id,
                channelId,
                name = string.IsNullOrWhiteSpace(name) ? DefaultName : name.Trim(),
                updatedAt
            },
            transaction);

        var listed = WheelEntry.From(Split(entries));

        if (listed.Count is 0) return;

        await connection.ExecuteAsync(
            InsertEntrySql,
            listed.Select((entry, index) => new
            {
                wheelId = id,
                position = index,
                label = entry.Label,
                slices = entry.Count,
            }).ToArray(),
            transaction);
    }

    private static IEnumerable<string> Split(string? entries)
    {
        return entries is null
            ? []
            : entries.Split(Separator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    private sealed class NamedRow
    {
        public Guid Id { get; init; }
        public int ChannelId { get; init; }
        public string? Name { get; init; }
        public string? Entries { get; init; }
        public DateTime UpdatedAt { get; init; }
    }

    private sealed class UnnamedRow
    {
        public int Id { get; init; }
        public string? Entries { get; init; }
    }
}