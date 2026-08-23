using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data.SubathonTimer;

namespace YEPPDash.Api.Repositories;

/// <summary>
/// The subathon timer lives in the shared <c>helix</c> schema rather than the dashboard's own
/// database, because the bot is the other half of this feature and writes the very same row. There
/// is no API between the two — YEPPBot owns the table, creates it, and drives it with the statements
/// below.
/// </summary>
/// <remarks>
/// Every command is a single UPDATE that works the new value out from the old one, never a read
/// followed by a write. A lone UPDATE takes its own row lock, so two people adding time in the same
/// second both land without a transaction, a FOR UPDATE, or a retry. It also means the bot can issue
/// exactly these statements: no part of how the timer moves lives only in this process.
/// </remarks>
public sealed class SubathonTimerRepository(MySqlConnection connection)
{
    private const string Columns = "id, running, endsAt, remaining, startSeconds, style, updatedAt";

    // Where the timer stands right now, in whichever of the two shapes it is in. The bot creates the
    // row when it joins a channel, so this is null for a channel the bot has never been in.
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

    // For the watcher, which asks after every channel someone is currently looking at in one go
    // rather than running a query per open overlay.
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

    // The bot inserts the row when it joins, but the dashboard can be opened for a channel it has
    // never been in. Cheaper to make sure than to explain an empty page.
    public async Task EnsureAsync(int channelId, CancellationToken cancellationToken)
    {
        await connection.ExecuteAsync(
            new CommandDefinition(
                "INSERT IGNORE INTO SubathonTimer (id) VALUES (@channelId)",
                new { channelId },
                cancellationToken: cancellationToken)
            );
    }

    // Paused to running: the remainder becomes a deadline. The running clause makes a second start
    // touch no rows at all, rather than push the deadline out again and hand back time already spent.
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

    // Running to paused: the deadline becomes a remainder. COALESCE covers a row that somehow claims
    // to be running without a deadline — remaining is NOT NULL, so that write would fail outright.
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

    /// <summary>Adds <paramref name="seconds"/> to the timer, or takes it off when negative.</summary>
    /// <remarks>
    /// The nested GREATEST is the whole trick, and the place a plainer version goes wrong. A running
    /// timer that passes its deadline keeps running with that deadline in the past — that *is* the
    /// state of having stopped at 00:00, and nothing has to set it. Shifting such a deadline directly
    /// would leave it in the past, so five minutes added to a subathon that ended an hour ago would
    /// visibly do nothing. Measuring from GREATEST(endsAt, now) instead starts it running again,
    /// which is what adding time is supposed to mean.
    ///
    /// The outer GREATEST is the same idea from the other side: taking off more than is left stops at
    /// zero rather than running negative. COALESCE only covers a running row with no deadline.
    /// </remarks>
    public async Task<SubathonTimerState?> AdjustAsync(
        int channelId, int seconds, CancellationToken cancellationToken)
    {
        // Two statements, because the two shapes keep the truth in different columns. Both are sent;
        // the running clause means exactly one of them ever matches a row.
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

    // Replaces whatever is left, and always leaves the timer stopped — the same as reset, which is
    // the other command that puts a number on the clock rather than nudging the one already there.
    // Setting a time is preparation, not a move in the run: leaving it counting would mean the value
    // just typed started draining before anyone had looked at it, and on a subathon the correction
    // costs real seconds. Whoever set it says when it starts.
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

    // Every command reads the row back rather than reporting what it meant to write. An UPDATE that
    // changes nothing touches no rows and is indistinguishable from a missing one, and half of these
    // are deliberately no-ops in the wrong state — so the row itself is the only honest answer.
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

        // MySQL DATETIME carries no zone, and everything here is written as UTC. Marking it back on
        // the way out is what keeps it from being read as local time further along.
        public SubathonTimerState ToState()
        {
            var endsAt = EndsAt is null ? (DateTime?)null : DateTime.SpecifyKind(EndsAt.Value, DateTimeKind.Utc);

            return new SubathonTimerState(
                Id, Running, endsAt, Remaining, StartSeconds, Style,
                DateTime.SpecifyKind(UpdatedAt, DateTimeKind.Utc));
        }
    }
}
