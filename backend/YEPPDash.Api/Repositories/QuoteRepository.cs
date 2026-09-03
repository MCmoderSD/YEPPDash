using System.Data;
using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data.Quote;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Repositories;

public sealed class QuoteRepository(MySqlConnection connection)
{
    private const int ParkedId = 0;

    public async Task<IReadOnlyList<Quote>> GetAllAsync(int channelId, CancellationToken cancellationToken)
    {
        var rows = await connection.QueryAsync<QuoteRow>(
            new CommandDefinition(
                "SELECT id, quote, timestamp FROM Quote WHERE channelId = @channelId ORDER BY id",
                new { channelId },
                cancellationToken: cancellationToken)
            );

        return [.. rows.Select(ToQuote)];
    }

    public async Task<Quote> AddAsync(int channelId, string text, CancellationToken cancellationToken)
    {
        await EnsureOpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var nextId = await connection.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COALESCE(MAX(id), 0) + 1 FROM Quote WHERE channelId = @channelId FOR UPDATE",
                new { channelId },
                transaction,
                cancellationToken: cancellationToken)
            );

        await connection.ExecuteAsync(
            new CommandDefinition(
                "INSERT INTO Quote (channelId, id, quote) VALUES (@channelId, @id, @quote)",
                new { channelId, id = nextId, quote = text },
                transaction,
                cancellationToken: cancellationToken)
            );

        var row = await connection.QuerySingleAsync<QuoteRow>(
            new CommandDefinition(
                "SELECT id, quote, timestamp FROM Quote WHERE channelId = @channelId AND id = @id",
                new { channelId, id = nextId },
                transaction,
                cancellationToken: cancellationToken)
            );

        await transaction.CommitAsync(cancellationToken);
        return ToQuote(row);
    }

    public async Task<IReadOnlyList<Quote>> ReplaceAllAsync(int channelId, IReadOnlyList<QuoteDraft> texts, CancellationToken cancellationToken)
    {
        await EnsureOpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM Quote WHERE channelId = @channelId",
                new { channelId },
                transaction,
                cancellationToken: cancellationToken)
            );

        if (texts.Count > 0)
        {
            var rows = texts.Select((draft, index) => new
            {
                channelId,
                id = index + 1,
                quote = draft.Text,
                timestamp = draft.Timestamp?.UtcDateTime
            });

            await connection.ExecuteAsync(
                new CommandDefinition(
                    """
                    INSERT INTO Quote (channelId, id, quote, timestamp)
                    VALUES (@channelId, @id, @quote, COALESCE(@timestamp, CURRENT_TIMESTAMP))
                    """,
                    rows,
                    transaction,
                    cancellationToken: cancellationToken)
                );
        }

        var written = await connection.QueryAsync<QuoteRow>(
            new CommandDefinition(
                "SELECT id, quote, timestamp FROM Quote WHERE channelId = @channelId ORDER BY id",
                new { channelId },
                transaction,
                cancellationToken: cancellationToken)
            );

        await transaction.CommitAsync(cancellationToken);
        return [.. written.Select(ToQuote)];
    }

    public async Task<Quote?> UpdateAsync(int channelId, int id, string text, CancellationToken cancellationToken)
    {
        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE Quote SET quote = @quote WHERE channelId = @channelId AND id = @id",
                new { channelId, id, quote = text },
                cancellationToken: cancellationToken)
            );

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
                cancellationToken: cancellationToken)
            );

        if (affected is 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return false;
        }

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
                cancellationToken: cancellationToken)
            );

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
                cancellationToken: cancellationToken)
            );

        await transaction.CommitAsync(cancellationToken);
        return [.. rows.Select(ToQuote)];
    }

    private async Task ShiftAsync(int channelId, int id, int target, MySqlTransaction transaction, CancellationToken cancellationToken)
    {
        await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE Quote SET id = @parked WHERE channelId = @channelId AND id = @id",
                new { channelId, id, parked = ParkedId },
                transaction,
                cancellationToken: cancellationToken));

        var (range, step) = id < target
            ? ("id > @id AND id <= @target", -1)
            : ("id >= @target AND id < @id", 1);

        await ShiftThroughNegativeSpaceAsync(channelId, range, step, new { channelId, id, target }, transaction, cancellationToken);

        await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE Quote SET id = @target WHERE channelId = @channelId AND id = @parked",
                new { channelId, target, parked = ParkedId },
                transaction,
                cancellationToken: cancellationToken)
            );
    }


    private async Task ShiftThroughNegativeSpaceAsync(int channelId, string range, int step, object parameters, MySqlTransaction transaction, CancellationToken cancellationToken)
    {
        await connection.ExecuteAsync(
            new CommandDefinition(
                $"UPDATE Quote SET id = -id WHERE channelId = @channelId AND {range}",
                parameters,
                transaction,
                cancellationToken: cancellationToken)
            );

        await connection.ExecuteAsync(
            new CommandDefinition(
                $"UPDATE Quote SET id = -id + ({step}) WHERE channelId = @channelId AND id < 0",
                new { channelId },
                transaction,
                cancellationToken: cancellationToken)
            );
    }

    private async Task<Quote?> GetAsync(int channelId, int id, CancellationToken cancellationToken)
    {
        var row = await connection.QuerySingleOrDefaultAsync<QuoteRow>(
            new CommandDefinition(
                "SELECT id, quote, timestamp FROM Quote WHERE channelId = @channelId AND id = @id",
                new { channelId, id },
                cancellationToken: cancellationToken)
            );

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
        if (connection.State is not ConnectionState.Open) await connection.OpenAsync(cancellationToken);
    }

    private static Quote ToQuote(QuoteRow row)
    {
        return new Quote(
            row.Id,
            row.Quote,
            new DateTimeOffset(row.Timestamp.AsUtc()));
    }

    private sealed class QuoteRow
    {
        public int Id { get; init; }
        public string Quote { get; init; } = "";
        public DateTime Timestamp { get; init; }
    }
}