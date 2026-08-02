using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data.Birthday;

namespace YEPPDash.Api.Repositories;

public sealed class BirthdayRepository(MySqlConnection connection)
{
    public async Task<Birthday?> GetAsync(int userId, CancellationToken cancellationToken)
    {
        var row = await connection.QuerySingleOrDefaultAsync<BirthdayRow>(
            new CommandDefinition(
                "SELECT id, day, month, year FROM Birthday WHERE id = @userId",
                new { userId },
                cancellationToken: cancellationToken)
            );

        return row is null ? null : ToBirthday(row);
    }

    public async Task<IReadOnlyList<Birthday>> GetAllAsync(CancellationToken cancellationToken)
    {
        var rows = await connection.QueryAsync<BirthdayRow>(
            new CommandDefinition(
                "SELECT id, day, month, year FROM Birthday",
                cancellationToken: cancellationToken)
            );

        return [.. rows.Select(ToBirthday)];
    }

    public async Task<bool> InsertAsync(Birthday birthday, CancellationToken cancellationToken)
    {
        try
        {
            await connection.ExecuteAsync(
                new CommandDefinition(
                    """
                    INSERT INTO Birthday (id, day, month, year)
                    VALUES (@UserId, @Day, @Month, @Year)
                    """,
                    birthday,
                    cancellationToken: cancellationToken)
                );

            return true;
        }
        catch (MySqlException exception) when (exception.ErrorCode is MySqlErrorCode.DuplicateKeyEntry)
        {
            return false;
        }
    }

    public async Task<bool> UpdateAsync(Birthday birthday, CancellationToken cancellationToken)
    {
        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE Birthday SET day = @Day, month = @Month, year = @Year WHERE id = @UserId",
                birthday,
                cancellationToken: cancellationToken)
            );

        return affected > 0 || await ExistsAsync(birthday.UserId, cancellationToken);
    }

    private async Task<bool> ExistsAsync(int userId, CancellationToken cancellationToken)
    {
        return await connection.ExecuteScalarAsync<long>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM Birthday WHERE id = @userId",
                new { userId },
                cancellationToken: cancellationToken)) > 0;
    }

    private static Birthday ToBirthday(BirthdayRow row)
    {
        return new Birthday(row.Id, row.Day, row.Month, row.Year);
    }

    private sealed class BirthdayRow
    {
        public int Id { get; init; }
        public sbyte Day { get; init; }
        public sbyte Month { get; init; }
        public short Year { get; init; }
    }
}