using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data.Bdsm;

namespace YEPPDash.Api.Repositories;

public sealed class BdsmRepository(MySqlConnection connection)
{
    private const string Select = "SELECT `user` AS UserId, id AS ResultId FROM BDSM";

    // Ordered here rather than after fetching: `timestamp` is one of the columns this no longer
    // reads, so the order it defines would otherwise be gone by the time the rows are used.
    private const string Newest = "ORDER BY `timestamp` DESC, id DESC";

    public async Task<IReadOnlyList<BdsmResultRef>> GetForUserAsync(int userId, CancellationToken cancellationToken)
    {
        var rows = await connection.QueryAsync<BdsmResultRef>(
            new CommandDefinition(
                $"{Select} WHERE `user` = @userId {Newest}",
                new { userId },
                cancellationToken: cancellationToken));

        return [.. rows];
    }

    // Listing several people shows where each of them stands, not their history, and a match
    // compares one result per person — both only ever want the most recent one.
    public async Task<IReadOnlyList<BdsmResultRef>> GetLatestForUsersAsync(IReadOnlyCollection<int> userIds, CancellationToken cancellationToken)
    {
        if (userIds.Count is 0) return [];

        var rows = await connection.QueryAsync<BdsmResultRef>(
            new CommandDefinition(
                """
                SELECT UserId, ResultId FROM (
                    SELECT `user` AS UserId, id AS ResultId,
                           ROW_NUMBER() OVER (PARTITION BY `user` ORDER BY `timestamp` DESC, id DESC) AS `position`
                    FROM BDSM
                    WHERE `user` IN @userIds
                ) ranked
                WHERE `position` = 1
                """,
                new { userIds },
                cancellationToken: cancellationToken));

        return [.. rows];
    }
}
