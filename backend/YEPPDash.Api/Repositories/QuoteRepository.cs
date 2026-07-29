using System.Data;
using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data;

namespace YEPPDash.Api.Repositories;

/// <summary>
/// Reads and writes YEPPBot's Quote table. The table is owned by the bot, so nothing here creates
/// or migrates it — it is expected to exist already.
/// </summary>
/// <remarks>
/// Quote ids are per-channel positions numbered from 1, not surrogate keys, so every write that
/// removes or moves a row has to renumber the rows around it. Those run in a transaction: a half
/// applied renumber would leave the list with duplicate or missing positions.
/// </remarks>
public sealed class QuoteRepository(MySqlConnection connection)
{
    // Ids start at 1 and the shift below parks rows in the negative range, so 0 is the one slot a
    // travelling row can wait in without colliding with either.
    private const int ParkedId = 0;

    public async Task<IReadOnlyList<Quote>> GetAllAsync(int channelId, CancellationToken cancellationToken)
    {
        var rows = await connection.QueryAsync<QuoteRow>(
            new CommandDefinition(
                "SELECT id, quote, timestamp FROM Quote WHERE channelId = @channelId ORDER BY id",
                new { channelId },
                cancellationToken: cancellationToken));

        return rows.Select(ToQuote).ToList();
    }

    public async Task<Quote> AddAsync(int channelId, string text, CancellationToken cancellationToken)
    {
        await EnsureOpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        // FOR UPDATE so two quotes added at once cannot pick the same next id and collide on the
        // (channelId, id) unique key.
        var nextId = await connection.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COALESCE(MAX(id), 0) + 1 FROM Quote WHERE channelId = @channelId FOR UPDATE",
                new { channelId },
                transaction,
                cancellationToken: cancellationToken));

        await connection.ExecuteAsync(
            new CommandDefinition(
                "INSERT INTO Quote (channelId, id, quote) VALUES (@channelId, @id, @quote)",
                new { channelId, id = nextId, quote = text },
                transaction,
                cancellationToken: cancellationToken));

        // Read back rather than assuming DateTime.UtcNow: the timestamp column defaults to the
        // database's clock, and that is the value every other reader will see.
        var row = await connection.QuerySingleAsync<QuoteRow>(
            new CommandDefinition(
                "SELECT id, quote, timestamp FROM Quote WHERE channelId = @channelId AND id = @id",
                new { channelId, id = nextId },
                transaction,
                cancellationToken: cancellationToken));

        await transaction.CommitAsync(cancellationToken);
        return ToQuote(row);
    }

    /// <summary>
    /// Swaps the channel's whole list for <paramref name="texts"/>, numbered from 1.
    /// </summary>
    /// <remarks>
    /// One transaction around the delete and the inserts: a failure partway through would
    /// otherwise leave the channel with the old quotes gone and only some of the new ones written.
    /// </remarks>
    public async Task<IReadOnlyList<Quote>> ReplaceAllAsync(
        int channelId, IReadOnlyList<QuoteDraft> texts, CancellationToken cancellationToken)
    {
        await EnsureOpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM Quote WHERE channelId = @channelId",
                new { channelId },
                transaction,
                cancellationToken: cancellationToken));

        if (texts.Count > 0)
        {
            // A timestamp of null lets the column default apply, so a quote imported without a date
            // is stamped by the database rather than silently backdated to the epoch.
            var rows = texts.Select((draft, index) => new
            {
                channelId,
                id = index + 1,
                quote = draft.Text,
                timestamp = draft.Timestamp?.UtcDateTime,
            });

            await connection.ExecuteAsync(
                new CommandDefinition(
                    """
                    INSERT INTO Quote (channelId, id, quote, timestamp)
                    VALUES (@channelId, @id, @quote, COALESCE(@timestamp, CURRENT_TIMESTAMP))
                    """,
                    rows,
                    transaction,
                    cancellationToken: cancellationToken));
        }

        var written = await connection.QueryAsync<QuoteRow>(
            new CommandDefinition(
                "SELECT id, quote, timestamp FROM Quote WHERE channelId = @channelId ORDER BY id",
                new { channelId },
                transaction,
                cancellationToken: cancellationToken));

        await transaction.CommitAsync(cancellationToken);
        return written.Select(ToQuote).ToList();
    }

    public async Task<Quote?> UpdateAsync(int channelId, int id, string text, CancellationToken cancellationToken)
    {
        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE Quote SET quote = @quote WHERE channelId = @channelId AND id = @id",
                new { channelId, id, quote = text },
                cancellationToken: cancellationToken));

        if (affected is 0 && !await ExistsAsync(channelId, id, cancellationToken)) return null;

        return await GetAsync(channelId, id, cancellationToken);
    }

    public async Task<bool> DeleteAsync(int channelId, int id, CancellationToken cancellationToken)
    {
        await EnsureOpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM Quote WHERE channelId = @channelId AND id = @id",
                new { channelId, id },
                transaction,
                cancellationToken: cancellationToken));

        if (affected is 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return false;
        }

        // Close the gap so the list stays 1..n.
        await ShiftThroughNegativeSpaceAsync(
            channelId,
            "id > @id",
            step: -1,
            new { channelId, id },
            transaction,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    /// <returns>The renumbered list, or <c>null</c> when the quote does not exist.</returns>
    public async Task<IReadOnlyList<Quote>?> MoveAsync(
        int channelId, int id, int position, CancellationToken cancellationToken)
    {
        await EnsureOpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var max = await connection.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COALESCE(MAX(id), 0) FROM Quote WHERE channelId = @channelId FOR UPDATE",
                new { channelId },
                transaction,
                cancellationToken: cancellationToken));

        var exists = await connection.ExecuteScalarAsync<long>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM Quote WHERE channelId = @channelId AND id = @id",
                new { channelId, id },
                transaction,
                cancellationToken: cancellationToken)) > 0;

        if (!exists)
        {
            await transaction.RollbackAsync(cancellationToken);
            return null;
        }

        // A caller nudging the first quote up or the last one down asks for a position outside the
        // list; clamping makes that a no-op instead of an error the UI would have to special-case.
        var target = Math.Clamp(position, 1, max);

        if (target != id)
        {
            await ShiftAsync(channelId, id, target, transaction, cancellationToken);
        }

        var rows = await connection.QueryAsync<QuoteRow>(
            new CommandDefinition(
                "SELECT id, quote, timestamp FROM Quote WHERE channelId = @channelId ORDER BY id",
                new { channelId },
                transaction,
                cancellationToken: cancellationToken));

        await transaction.CommitAsync(cancellationToken);
        return rows.Select(ToQuote).ToList();
    }

    private async Task ShiftAsync(
        int channelId, int id, int target, MySqlTransaction transaction, CancellationToken cancellationToken)
    {
        // Park the travelling row so its old slot is free for the rows it passes.
        await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE Quote SET id = @parked WHERE channelId = @channelId AND id = @id",
                new { channelId, id, parked = ParkedId },
                transaction,
                cancellationToken: cancellationToken));

        // Everything between the old and the new slot moves one step towards the freed slot.
        var (range, step) = id < target
            ? ("id > @id AND id <= @target", -1)
            : ("id >= @target AND id < @id", 1);

        await ShiftThroughNegativeSpaceAsync(
            channelId, range, step, new { channelId, id, target }, transaction, cancellationToken);

        await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE Quote SET id = @target WHERE channelId = @channelId AND id = @parked",
                new { channelId, target, parked = ParkedId },
                transaction,
                cancellationToken: cancellationToken));
    }

    /// <summary>
    /// Adds <paramref name="step"/> to the id of every row matching <paramref name="range"/>.
    /// </summary>
    /// <remarks>
    /// Done in two passes through negative ids rather than one <c>id = id ± 1</c> statement. A
    /// single pass overlaps its own source and target values, so it only works if the rows happen
    /// to be visited in the right order — which MySQL does not promise when the ordering column is
    /// the one being rewritten. Flipping the sign first parks the whole range where no live row can
    /// sit, so neither pass can collide with the unique key whatever order the rows are visited in.
    /// </remarks>
    private async Task ShiftThroughNegativeSpaceAsync(
        int channelId,
        string range,
        int step,
        object parameters,
        MySqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        await connection.ExecuteAsync(
            new CommandDefinition(
                $"UPDATE Quote SET id = -id WHERE channelId = @channelId AND {range}",
                parameters,
                transaction,
                cancellationToken: cancellationToken));

        await connection.ExecuteAsync(
            new CommandDefinition(
                $"UPDATE Quote SET id = -id + ({step}) WHERE channelId = @channelId AND id < 0",
                new { channelId },
                transaction,
                cancellationToken: cancellationToken));
    }

    private async Task<Quote?> GetAsync(int channelId, int id, CancellationToken cancellationToken)
    {
        var row = await connection.QuerySingleOrDefaultAsync<QuoteRow>(
            new CommandDefinition(
                "SELECT id, quote, timestamp FROM Quote WHERE channelId = @channelId AND id = @id",
                new { channelId, id },
                cancellationToken: cancellationToken));

        return row is null ? null : ToQuote(row);
    }

    private async Task<bool> ExistsAsync(int channelId, int id, CancellationToken cancellationToken)
    {
        return await connection.ExecuteScalarAsync<long>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM Quote WHERE channelId = @channelId AND id = @id",
                new { channelId, id },
                cancellationToken: cancellationToken)) > 0;
    }

    private async Task EnsureOpenAsync(CancellationToken cancellationToken)
    {
        // Dapper opens and closes the connection per call, but a transaction has to span several,
        // so it is opened here and left open for the lifetime of the injected connection.
        if (connection.State is not ConnectionState.Open) await connection.OpenAsync(cancellationToken);
    }

    private static Quote ToQuote(QuoteRow row)
    {
        // The column is a TIMESTAMP, which MySQL hands back in the session time zone. Treating it
        // as UTC matches how the rest of the app stores and reads its own timestamps.
        return new Quote(
            row.Id,
            row.Quote,
            new DateTimeOffset(DateTime.SpecifyKind(row.Timestamp, DateTimeKind.Utc)));
    }

    private sealed class QuoteRow
    {
        public int Id { get; init; }
        public string Quote { get; init; } = "";
        public DateTime Timestamp { get; init; }
    }
}
