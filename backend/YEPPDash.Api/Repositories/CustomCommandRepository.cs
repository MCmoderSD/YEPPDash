using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data;

namespace YEPPDash.Api.Repositories;

/// <summary>
/// Reads and writes YEPPBot's CustomCommands table. The table is owned by the bot, so nothing here
/// creates or migrates it — it is expected to exist already.
/// </summary>
/// <remarks>
/// <para>
/// The key is (id, name), so a command is addressed by the word chat types rather than by a
/// surrogate id, and renaming one rewrites part of its own key.
/// </para>
/// <para>
/// The table collates <c>utf8mb4_bin</c>, which compares byte for byte — <c>Hug</c> and <c>hug</c>
/// are two different keys to it. Everything written here is lower-cased first (by the service), so
/// the equality the routes rely on is the equality the index gives them.
/// </para>
/// <para>
/// A command's aliases share one <c>alias</c> column, comma-separated, so the 500 character ceiling
/// on it applies to the whole list rather than to any one alias.
/// </para>
/// </remarks>
public sealed class CustomCommandRepository(MySqlConnection connection)
{
    private const string Columns = "name, alias, message, active, type, userLevel";

    public async Task<IReadOnlyList<CustomCommand>> GetAllAsync(int channelId, CancellationToken cancellationToken)
    {
        var rows = await connection.QueryAsync<CommandRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM CustomCommands WHERE id = @channelId ORDER BY name",
                new { channelId },
                cancellationToken: cancellationToken));

        return rows.Select(ToCommand).ToList();
    }

    public async Task<CustomCommand?> GetAsync(int channelId, string name, CancellationToken cancellationToken)
    {
        var row = await connection.QuerySingleOrDefaultAsync<CommandRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM CustomCommands WHERE id = @channelId AND name = @name",
                new { channelId, name },
                cancellationToken: cancellationToken));

        return row is null ? null : ToCommand(row);
    }

    /// <returns><c>false</c> when the channel already has a command under that name.</returns>
    /// <exception cref="MySqlException">The channel has no row in YEPPBot's User table.</exception>
    public async Task<bool> AddAsync(int channelId, CustomCommand command, CancellationToken cancellationToken)
    {
        try
        {
            await connection.ExecuteAsync(
                new CommandDefinition(
                    """
                    INSERT INTO CustomCommands (id, name, alias, message, active, type, userLevel)
                    VALUES (@channelId, @name, @alias, @message, @active, @type, @userLevel)
                    """,
                    Parameters(channelId, command),
                    cancellationToken: cancellationToken));

            return true;
        }
        // Letting the insert fail is what makes this race-free: checking first and inserting after
        // would leave a window for a second request to take the name in between.
        catch (MySqlException exception) when (exception.ErrorCode is MySqlErrorCode.DuplicateKeyEntry)
        {
            return false;
        }
    }

    /// <param name="name">The name the command is stored under, which the update may change.</param>
    /// <returns>The stored command, or <c>null</c> when there is nothing under that name.</returns>
    /// <exception cref="MySqlException">The new name is already taken by another command.</exception>
    public async Task<CustomCommand?> UpdateAsync(
        int channelId, string name, CustomCommand command, CancellationToken cancellationToken)
    {
        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                """
                UPDATE CustomCommands
                SET name = @name, alias = @alias, message = @message,
                    active = @active, type = @type, userLevel = @userLevel
                WHERE id = @channelId AND name = @currentName
                """,
                Parameters(channelId, command, currentName: name),
                cancellationToken: cancellationToken));

        // Zero rows can mean the row is missing or that it already held exactly these values, so
        // existence is what decides between the two.
        if (affected is 0 && !await ExistsAsync(channelId, name, cancellationToken)) return null;

        return await GetAsync(channelId, command.Name, cancellationToken);
    }

    /// <returns>The stored command, or <c>null</c> when there is nothing under that name.</returns>
    public async Task<CustomCommand?> SetActiveAsync(
        int channelId, string name, bool active, CancellationToken cancellationToken)
    {
        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE CustomCommands SET active = @active WHERE id = @channelId AND name = @name",
                new { channelId, name, active },
                cancellationToken: cancellationToken));

        if (affected is 0 && !await ExistsAsync(channelId, name, cancellationToken)) return null;

        return await GetAsync(channelId, name, cancellationToken);
    }

    public async Task<bool> DeleteAsync(int channelId, string name, CancellationToken cancellationToken)
    {
        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM CustomCommands WHERE id = @channelId AND name = @name",
                new { channelId, name },
                cancellationToken: cancellationToken));

        return affected > 0;
    }

    private async Task<bool> ExistsAsync(int channelId, string name, CancellationToken cancellationToken)
    {
        return await connection.ExecuteScalarAsync<long>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM CustomCommands WHERE id = @channelId AND name = @name",
                new { channelId, name },
                cancellationToken: cancellationToken)) > 0;
    }

    private static object Parameters(int channelId, CustomCommand command, string? currentName = null)
    {
        return new
        {
            channelId,
            currentName,
            name = command.Name,
            alias = JoinAliases(command.Aliases),
            message = command.Message,
            active = command.Active,
            type = ToColumn(command.ResponseType),
            userLevel = ToColumn(command.UserLevel),
        };
    }

    /// <summary>The one column all of a command's aliases share.</summary>
    public static string JoinAliases(IEnumerable<string> aliases)
    {
        return string.Join(',', aliases);
    }

    private static IReadOnlyList<string> SplitAliases(string alias)
    {
        return alias.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    // The table spells its enums in lower case and the C# ones differ only in that, so the name is
    // what carries across rather than the position — reordering either side stays harmless.
    private static string ToColumn<T>(T value) where T : struct, Enum
    {
        return value.ToString().ToLowerInvariant();
    }

    private static T ToEnum<T>(string value, T fallback) where T : struct, Enum
    {
        return Enum.TryParse<T>(value, ignoreCase: true, out var parsed) ? parsed : fallback;
    }

    private static CustomCommand ToCommand(CommandRow row)
    {
        return new CustomCommand(
            row.Name,
            SplitAliases(row.Alias),
            row.Message,
            row.Active,
            // A value the table allows but this app does not know yet reads as the default rather
            // than throwing: one unfamiliar row should not take the whole list down.
            ToEnum(row.Type, CommandResponseType.Reply),
            ToEnum(row.UserLevel, CommandUserLevel.Everyone));
    }

    private sealed class CommandRow
    {
        public string Name { get; init; } = "";
        public string Alias { get; init; } = "";
        public string Message { get; init; } = "";
        public bool Active { get; init; }
        public string Type { get; init; } = "";
        public string UserLevel { get; init; } = "";
    }
}
