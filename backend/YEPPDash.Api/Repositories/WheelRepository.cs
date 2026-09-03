using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data.Wheel;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Repositories;

public readonly record struct WheelCounts(int Entries, int Slices);

public sealed class WheelRepository(YeppDashConnectionFactory connections)
{
    public const string CreateTableSql = """
        CREATE TABLE IF NOT EXISTS Wheels
        (
            id        CHAR(36)    NOT NULL PRIMARY KEY,
            channelId INT         NOT NULL,
            name      VARCHAR(80) NOT NULL DEFAULT (''),
            updatedAt DATETIME(3) NOT NULL,
            INDEX ix_Wheels_channel (channelId, updatedAt)
        );

        CREATE TABLE IF NOT EXISTS WheelEntries
        (
            wheelId  CHAR(36) NOT NULL,
            position INT      NOT NULL,
            label    TEXT     NOT NULL,
            slices   INT      NOT NULL DEFAULT (1),
            PRIMARY KEY (wheelId, position)
        )
        """;

    private const string Columns = "id, channelId, name, updatedAt";

    private const string InsertEntrySql =
        "INSERT INTO WheelEntries (wheelId, position, label, slices) VALUES (@wheelId, @position, @label, @slices)";

    public async Task<IReadOnlyList<WheelConfig>> GetChannelAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<WheelRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM Wheels WHERE channelId = @channelId ORDER BY updatedAt DESC, id DESC",
                new { channelId },
                cancellationToken: cancellationToken)
            );

        return [.. rows.Select(row => row.ToConfig())];
    }

    // One query for the whole channel rather than the entries of every wheel in turn: a list of
    // cards only wants how many of each, never the labels themselves.
    public async Task<IReadOnlyDictionary<Guid, WheelCounts>> CountsAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<CountRow>(
            new CommandDefinition(
                """
                SELECT w.id                                                                            AS WheelId,
                       (SELECT COUNT(*) FROM WheelEntries e WHERE e.wheelId = w.id)                     AS Entries,
                       (SELECT CAST(COALESCE(SUM(e.slices), 0) AS SIGNED)
                        FROM WheelEntries e WHERE e.wheelId = w.id)                                     AS Slices
                FROM Wheels w
                WHERE w.channelId = @channelId
                """,
                new { channelId },
                cancellationToken: cancellationToken)
            );

        return rows.ToDictionary(row => row.WheelId, row => new WheelCounts(row.Entries, row.Slices));
    }

    public async Task<int> CountAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        return await connection.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM Wheels WHERE channelId = @channelId",
                new { channelId },
                cancellationToken: cancellationToken)
            );
    }

    public async Task<WheelConfig?> GetAsync(int channelId, Guid wheelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var row = await connection.QuerySingleOrDefaultAsync<WheelRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM Wheels WHERE id = @wheelId AND channelId = @channelId",
                new { channelId, wheelId },
                cancellationToken: cancellationToken)
            );

        return row?.ToConfig();
    }

    public async Task<WheelConfig?> FindAsync(Guid wheelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var row = await connection.QuerySingleOrDefaultAsync<WheelRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM Wheels WHERE id = @wheelId",
                new { wheelId },
                cancellationToken: cancellationToken)
            );

        return row?.ToConfig();
    }

    public async Task<IReadOnlyList<WheelEntry>> EntriesAsync(Guid wheelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<EntryRow>(
            new CommandDefinition(
                "SELECT label, slices FROM WheelEntries WHERE wheelId = @wheelId ORDER BY position",
                new { wheelId },
                cancellationToken: cancellationToken)
            );

        return [.. rows.Select(row => new WheelEntry(row.Label, row.Slices))];
    }

    public async Task InsertAsync(WheelConfig wheel, IReadOnlyList<WheelEntry> entries, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await connection.ExecuteAsync(
            new CommandDefinition(
                $"INSERT INTO Wheels ({Columns}) VALUES (@Id, @ChannelId, @Name, @UpdatedAt)",
                wheel,
                transaction,
                cancellationToken: cancellationToken)
            );

        await WriteEntriesAsync(connection, transaction, wheel.Id, entries, cancellationToken);

        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<bool> UpdateAsync(WheelConfig wheel, IReadOnlyList<WheelEntry> entries, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                """
                UPDATE Wheels
                SET name = @Name, updatedAt = @UpdatedAt
                WHERE id = @Id AND channelId = @ChannelId
                """,
                wheel,
                transaction,
                cancellationToken: cancellationToken)
            );

        if (affected is 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return false;
        }

        await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM WheelEntries WHERE wheelId = @Id",
                new { wheel.Id },
                transaction,
                cancellationToken: cancellationToken)
            );

        await WriteEntriesAsync(connection, transaction, wheel.Id, entries, cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return true;
    }

    public async Task<bool> DeleteAsync(int channelId, Guid wheelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM Wheels WHERE id = @wheelId AND channelId = @channelId",
                new { channelId, wheelId },
                transaction,
                cancellationToken: cancellationToken)
            );

        if (affected > 0)
        {
            await connection.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM WheelEntries WHERE wheelId = @wheelId",
                    new { wheelId },
                    transaction,
                    cancellationToken: cancellationToken)
                );
        }

        await transaction.CommitAsync(cancellationToken);

        return affected > 0;
    }

    private static Task WriteEntriesAsync(
        MySqlConnection connection,
        MySqlTransaction transaction,
        Guid wheelId,
        IReadOnlyList<WheelEntry> entries,
        CancellationToken cancellationToken)
    {
        if (entries.Count is 0) return Task.CompletedTask;

        var rows = entries
            .Select((entry, index) => new { wheelId, position = index, label = entry.Label, slices = entry.Count })
            .ToArray();

        return connection.ExecuteAsync(
            new CommandDefinition(InsertEntrySql, rows, transaction, cancellationToken: cancellationToken));
    }

    private sealed class WheelRow
    {
        public Guid Id { get; init; }
        public int ChannelId { get; init; }
        public string Name { get; init; } = "";
        public DateTime UpdatedAt { get; init; }

        public WheelConfig ToConfig()
        {
            return new WheelConfig(Id, ChannelId, Name, UpdatedAt.AsUtc());
        }
    }

    private sealed class EntryRow
    {
        public string Label { get; init; } = "";
        public int Slices { get; init; }
    }

    private sealed class CountRow
    {
        public Guid WheelId { get; init; }
        public int Entries { get; init; }
        public int Slices { get; init; }
    }
}