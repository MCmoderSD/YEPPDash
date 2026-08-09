using Dapper;
using MySqlConnector;

namespace YEPPDash.Api.Repositories;

/// <summary>
/// The <c>Blacklist</c> table, which YEPPBot owns: a row is one command switched off for one
/// channel. There is no row for a module that is on, so "enabled" is the absence of a row.
/// </summary>
/// <remarks>
/// The table collates utf8mb4_bin, so the bot's lookups are byte for byte. Every command written
/// here is already lower-cased by the catalogue, which is what the bot stores too.
/// </remarks>
public sealed class ModuleRepository(MySqlConnection connection)
{
    public async Task<IReadOnlyList<string>> GetBlockedAsync(int channelId, CancellationToken cancellationToken)
    {
        var rows = await connection.QueryAsync<string>(
            new CommandDefinition(
                "SELECT command FROM Blacklist WHERE id = @channelId",
                new { channelId },
                cancellationToken: cancellationToken));

        return rows.ToList();
    }

    /// <returns><c>false</c> when the command was already blocked.</returns>
    /// <exception cref="MySqlException">The channel has no row in YEPPBot's Channel table.</exception>
    public async Task<bool> BlockAsync(int channelId, string command, CancellationToken cancellationToken)
    {
        try
        {
            // NOT EXISTS rather than INSERT IGNORE: IGNORE downgrades the foreign key violation to a
            // warning too, which would turn a channel the bot has never joined into a silent success.
            var affected = await connection.ExecuteAsync(
                new CommandDefinition(
                    """
                    INSERT INTO Blacklist (id, command)
                    SELECT @channelId, @command FROM DUAL
                    WHERE NOT EXISTS (
                        SELECT 1 FROM Blacklist WHERE id = @channelId AND command = @command
                    )
                    """,
                    new { channelId, command },
                    cancellationToken: cancellationToken));

            return affected > 0;
        }
        // Two requests racing past the NOT EXISTS at once; the second one lost, which is the same
        // outcome as finding it already blocked.
        catch (MySqlException exception) when (exception.ErrorCode is MySqlErrorCode.DuplicateKeyEntry)
        {
            return false;
        }
    }

    /// <returns><c>false</c> when the command was not blocked to begin with.</returns>
    public async Task<bool> UnblockAsync(int channelId, string command, CancellationToken cancellationToken)
    {
        var affected = await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM Blacklist WHERE id = @channelId AND command = @command",
                new { channelId, command },
                cancellationToken: cancellationToken));

        return affected > 0;
    }
}
