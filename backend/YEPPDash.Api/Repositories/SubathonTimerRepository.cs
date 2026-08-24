using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data.SubathonTimer;

namespace YEPPDash.Api.Repositories;

public sealed class SubathonTimerRepository(MySqlConnection connection)
{
    private const string Columns = "id, running, endsAt, remaining, startSeconds, style, updatedAt";

    public async Task<SubathonTimerState?> GetAsync(int channelId, CancellationToken cancellationToken)
    {
        var row = await connection.QuerySingleOrDefaultAsync<TimerRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM SubathonTimer WHERE id = @channelId",
                new { channelId },
                cancellationToken: cancellationToken)
            );

        return row?.ToState();
    }

    public async Task<IReadOnlyList<SubathonTimerState>> GetManyAsync(
        IReadOnlyCollection<int> channelIds, CancellationToken cancellationToken)
    {
        if (channelIds.Count is 0) return [];

        var rows = await connection.QueryAsync<TimerRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM SubathonTimer WHERE id IN @channelIds",
                new { channelIds },
                cancellationToken: cancellationToken)
            );

        return [.. rows.Select(row => row.ToState())];
    }

    public async Task EnsureAsync(int channelId, CancellationToken cancellationToken)
    {
        await connection.ExecuteAsync(
            new CommandDefinition(
                "INSERT IGNORE INTO SubathonTimer (id) VALUES (@channelId)",
                new { channelId },
                cancellationToken: cancellationToken)
            );
    }

    public Task<SubathonTimerState?> StartAsync(int channelId, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            """
            UPDATE SubathonTimer
               SET running   = b'1',
                   endsAt    = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL remaining SECOND),
                   remaining = 0
             WHERE id = @channelId AND running = b'0'
            """,
            new { channelId },
            cancellationToken);
    }

    public Task<SubathonTimerState?> PauseAsync(int channelId, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            """
            UPDATE SubathonTimer
               SET running   = b'0',
                   remaining = GREATEST(0, COALESCE(TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(3), endsAt), 0)),
                   endsAt    = NULL
             WHERE id = @channelId AND running = b'1'
            """,
            new { channelId },
            cancellationToken);
    }

    public Task<SubathonTimerState?> ResetAsync(int channelId, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            """
            UPDATE SubathonTimer
               SET running = b'0', endsAt = NULL, remaining = startSeconds
             WHERE id = @channelId
            """,
            new { channelId },
            cancellationToken);
    }

    public async Task<SubathonTimerState?> AdjustAsync(
        int channelId, int seconds, CancellationToken cancellationToken)
    {

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                UPDATE SubathonTimer
                   SET endsAt = GREATEST(
                           DATE_ADD(
                               GREATEST(COALESCE(endsAt, UTC_TIMESTAMP(3)), UTC_TIMESTAMP(3)),
                               INTERVAL @seconds SECOND),
                           UTC_TIMESTAMP(3))
                 WHERE id = @channelId AND running = b'1'
                """,
                new { channelId, seconds },
                cancellationToken: cancellationToken)
            );

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                UPDATE SubathonTimer
                   SET remaining = GREATEST(0, remaining + @seconds)
                 WHERE id = @channelId AND running = b'0'
                """,
                new { channelId, seconds },
                cancellationToken: cancellationToken)
            );

        return await GetAsync(channelId, cancellationToken);
    }

    public Task<SubathonTimerState?> SetAsync(int channelId, int seconds, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            """
            UPDATE SubathonTimer
               SET running = b'0', endsAt = NULL, remaining = @seconds
             WHERE id = @channelId
            """,
            new { channelId, seconds },
            cancellationToken);
    }

    public Task<SubathonTimerState?> SaveConfigAsync(
        int channelId, int startSeconds, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            "UPDATE SubathonTimer SET startSeconds = @startSeconds WHERE id = @channelId",
            new { channelId, startSeconds },
            cancellationToken);
    }

    public Task<SubathonTimerState?> SaveStyleAsync(
        int channelId, string style, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            "UPDATE SubathonTimer SET style = @style WHERE id = @channelId",
            new { channelId, style },
            cancellationToken);
    }

    private async Task<SubathonTimerState?> MutateAsync(
        int channelId, string sql, object parameters, CancellationToken cancellationToken)
    {
        await connection.ExecuteAsync(new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));

        return await GetAsync(channelId, cancellationToken);
    }

    private sealed class TimerRow
    {
        public int Id { get; init; }
        public bool Running { get; init; }
        public DateTime? EndsAt { get; init; }
        public int Remaining { get; init; }
        public int StartSeconds { get; init; }
        public string Style { get; init; } = string.Empty;
        public DateTime UpdatedAt { get; init; }

        public SubathonTimerState ToState()
        {
            var endsAt = EndsAt is null ? (DateTime?)null : DateTime.SpecifyKind(EndsAt.Value, DateTimeKind.Utc);

            return new SubathonTimerState(
                Id, Running, endsAt, Remaining, StartSeconds, Style,
                DateTime.SpecifyKind(UpdatedAt, DateTimeKind.Utc));
        }
    }
}