using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data.Queue;

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

    // Removing one entry is a single self-referential UPDATE, so two moderators clicking at the
    // same moment cannot lose each other's work: the row lock comes with the statement, and
    // neither side ever holds a stale copy of the list in memory.
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

    // The list with @userId taken out of it, however deep it sat.
    private const string Without =
        "TRIM(BOTH ',' FROM REPLACE(CONCAT(',', queue, ','), CONCAT(',', @userId, ','), ','))";

    // How many are left once it is out.
    private const string Length =
        $"IF({Without} = '', 0, LENGTH({Without}) - LENGTH(REPLACE({Without}, ',', '')) + 1)";

    // Where it lands, clamped here rather than by the caller: a statement that cannot be handed an
    // index off the end cannot duplicate the tail, which is exactly what an unclamped one does.
    private const string Landing = $"GREATEST(0, LEAST(@index, {Length}))";

    // Still a single UPDATE, like every other mutation: take the entry out, cut the remainder at the
    // landing place, and put the three pieces back together. CONCAT_WS drops the NULLs, which is what
    // keeps the two ends — moved to the very front, moved to the very back — from growing a stray
    // comma instead of an entry.
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

        // Only drop the head we just read. Without that guard a second moderator advancing between
        // these two statements would have us remove somebody nobody has looked at yet.
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

    // The table spells its enum in lower case and the C# one differs only in that, so the name is
    // what carries across rather than the position — reordering either side stays harmless.
    private static string ToColumn(QueueRequirement value)
    {
        return value.ToString().ToLowerInvariant();
    }

    private static QueueRequirement ToRequirement(string value)
    {
        // A value the table allows but this app does not know yet reads as the default rather than
        // throwing: one unfamiliar row should not take the whole page down.
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
                QueueLimits.Separator,
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            return new QueueState(
                Id,
                IsOpen,
                ToRequirement(Requirement),
                entries,
                DateTime.SpecifyKind(UpdatedAt, DateTimeKind.Utc));
        }
    }
}
