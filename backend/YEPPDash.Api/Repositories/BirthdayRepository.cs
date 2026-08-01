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
                cancellationToken: cancellationToken));

        return row is null ? null : ToBirthday(row);
    }

    public async Task<IReadOnlyList<Birthday>> GetAllAsync(CancellationToken cancellationToken)
    {
        var rows = await connection.QueryAsync<BirthdayRow>(
            new CommandDefinition(
                "SELECT id, day, month, year FROM Birthday",
                cancellationToken: cancellationToken));

        return rows.Select(ToBirthday).ToList();
    }

    /// <returns><c>false</c> when the user already has a birthday.</returns>
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
                    cancellationToken: cancellationToken));

            return true;
        }
        // Letting the insert fail is what makes this race-free — checking first and inserting after
        // would leave a window for a second request. INSERT IGNORE would swallow the foreign key
        // violation as well, and that one has to reach the caller.
        catch (MySqlException exception) when (exception.ErrorCode is MySqlErrorCode.DuplicateKeyEntry)
        {
            return false;
        }
    }

    /// <returns><c>false</c> when the user has no birthday to update.</returns>
    public async Task<bool> UpdateAsync(Birthday birthday, CancellationToken cancellationToken)
    {
        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE Birthday SET day = @Day, month = @Month, year = @Year WHERE id = @UserId",
                birthday,
                cancellationToken: cancellationToken));

        // Zero rows can mean the row is missing or that it already held this date, depending on how
        // the connector counts, so existence is what decides between the two.
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

    /// <remarks>
    /// Typed the way MySQL hands the columns back — TINYINT is an <see cref="sbyte"/> and SMALLINT a
    /// <see cref="short"/> — so the widening to int happens in C# rather than in Dapper's mapper.
    /// </remarks>
    private sealed class BirthdayRow
    {
        public int Id { get; init; }
        public sbyte Day { get; init; }
        public sbyte Month { get; init; }
        public short Year { get; init; }
    }
}
