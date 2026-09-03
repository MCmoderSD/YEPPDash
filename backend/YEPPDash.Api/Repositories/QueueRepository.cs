using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data.Queue;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Repositories;

public sealed class QueueRepository(MySqlConnection connection)
{
    private const string Columns = "id, isOpen, requirement, queue, updatedAt";

    public async Task<QueueState?> GetAsync(int channelId, CancellationToken cancellationToken)
    {
        var row = await connection.QuerySingleOrDefaultAsync<QueueRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM Queue WHERE id = @channelId",
                new { channelId },
                cancellationToken: cancellationToken)
            );

        return row?.ToState();
    }

    public async Task<IReadOnlyList<QueueState>> GetManyAsync(
        IReadOnlyCollection<int> channelIds, CancellationToken cancellationToken)
    {
        if (channelIds.Count is 0) return [];

        var rows = await connection.QueryAsync<QueueRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM Queue WHERE id IN @channelIds",
                new { channelIds },
                cancellationToken: cancellationToken)
            );

        return [.. rows.Select(row => row.ToState())];
    }

    public async Task EnsureAsync(int channelId, CancellationToken cancellationToken)
    {
        await connection.ExecuteAsync(
            new CommandDefinition(
                "INSERT IGNORE INTO Queue (id) VALUES (@channelId)",
                new { channelId },
                cancellationToken: cancellationToken)
            );
    }

    public Task<QueueState?> OpenAsync(int channelId, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            "UPDATE Queue SET isOpen = b'1' WHERE id = @channelId AND isOpen = b'0'",
            new { channelId },
            cancellationToken);
    }

    public Task<QueueState?> CloseAsync(int channelId, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            "UPDATE Queue SET isOpen = b'0' WHERE id = @channelId AND isOpen = b'1'",
            new { channelId },
            cancellationToken);
    }

    public Task<QueueState?> ClearAsync(int channelId, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            "UPDATE Queue SET queue = '' WHERE id = @channelId AND queue <> ''",
            new { channelId },
            cancellationToken);
    }

    public Task<QueueState?> RemoveAsync(int channelId, string userId, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            """
            UPDATE Queue
               SET queue = TRIM(BOTH ',' FROM
                       REPLACE(CONCAT(',', queue, ','), CONCAT(',', @userId, ','), ','))
             WHERE id = @channelId AND FIND_IN_SET(@userId, queue) > 0
            """,
            new { channelId, userId },
            cancellationToken);
    }

    private const string Without = "TRIM(BOTH ',' FROM REPLACE(CONCAT(',', queue, ','), CONCAT(',', @userId, ','), ','))";
    private const string Length = $"IF({Without} = '', 0, LENGTH({Without}) - LENGTH(REPLACE({Without}, ',', '')) + 1)";
    private const string Landing = $"GREATEST(0, LEAST(@index, {Length}))";

    public Task<QueueState?> MoveAsync(
        int channelId, string userId, int index, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            $"""
             UPDATE Queue
                SET queue = CONCAT_WS(',',
                        NULLIF(SUBSTRING_INDEX({Without}, ',', {Landing}), ''),
                        @userId,
                        NULLIF(SUBSTRING_INDEX({Without}, ',', {Landing} - ({Length})), ''))
              WHERE id = @channelId AND FIND_IN_SET(@userId, queue) > 0
             """,
            new { channelId, userId, index },
            cancellationToken);
    }

    public async Task<QueueState?> NextAsync(int channelId, CancellationToken cancellationToken)
    {
        var head = await connection.QuerySingleOrDefaultAsync<string?>(
            new CommandDefinition(
                "SELECT SUBSTRING_INDEX(queue, ',', 1) FROM Queue WHERE id = @channelId",
                new { channelId },
                cancellationToken: cancellationToken)
            );

        if (string.IsNullOrEmpty(head)) return await GetAsync(channelId, cancellationToken);

        return await MutateAsync(
            channelId,
            """
            UPDATE Queue
               SET queue = IF(LOCATE(',', queue) > 0, SUBSTRING(queue, LOCATE(',', queue) + 1), '')
             WHERE id = @channelId AND queue <> '' AND SUBSTRING_INDEX(queue, ',', 1) = @head
            """,
            new { channelId, head },
            cancellationToken);
    }

    public Task<QueueState?> SaveRequirementAsync(
        int channelId, QueueRequirement requirement, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            "UPDATE Queue SET requirement = @requirement WHERE id = @channelId",
            new { channelId, requirement = ToColumn(requirement) },
            cancellationToken);
    }

    private async Task<QueueState?> MutateAsync(
        int channelId, string sql, object parameters, CancellationToken cancellationToken)
    {
        await connection.ExecuteAsync(new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));

        return await GetAsync(channelId, cancellationToken);
    }

    private static string ToColumn(QueueRequirement value)
    {
        return value.ToString().ToLowerInvariant();
    }

    private static QueueRequirement ToRequirement(string value)
    {
        return Enum.TryParse<QueueRequirement>(value, ignoreCase: true, out var parsed)
            ? parsed
            : QueueRequirement.Everyone;
    }

    private sealed class QueueRow
    {
        public int Id { get; init; }
        public bool IsOpen { get; init; }
        public string Requirement { get; init; } = string.Empty;
        public string Queue { get; init; } = string.Empty;
        public DateTime UpdatedAt { get; init; }

        public QueueState ToState()
        {
            var entries = Queue.Split(
                ',',
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            return new QueueState(
                Id,
                IsOpen,
                ToRequirement(Requirement),
                entries,
                UpdatedAt.AsUtc());
        }
    }
}