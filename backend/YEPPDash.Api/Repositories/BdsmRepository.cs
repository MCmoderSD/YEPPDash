using System.Globalization;
using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data.Bdsm;

namespace YEPPDash.Api.Repositories;

public sealed class BdsmRepository(MySqlConnection connection)
{
    private static readonly string Columns = string.Join(", ", new[] { "id", "`user`", "`timestamp`", "version", "gender", "ageGroup" }.Concat(BdsmTraits.All.Select(trait => $"`{trait}`")));

    public async Task<IReadOnlyList<BdsmResult>> GetForUserAsync(int userId, CancellationToken cancellationToken)
    {
        var rows = await connection.QueryAsync(
            new CommandDefinition(
                $"SELECT {Columns} FROM BDSM WHERE `user` = @userId ORDER BY `timestamp` DESC, id DESC",
                new { userId },
                cancellationToken: cancellationToken)
            );

        return ToResults(rows);
    }

    public async Task<IReadOnlyList<BdsmResult>> GetLatestForUsersAsync(IReadOnlyCollection<int> userIds, CancellationToken cancellationToken)
    {
        if (userIds.Count is 0) return [];

        var rows = await connection.QueryAsync(
            new CommandDefinition(
                $"""
                 SELECT {Columns} FROM (
                     SELECT {Columns},
                            ROW_NUMBER() OVER (PARTITION BY `user` ORDER BY `timestamp` DESC, id DESC) AS `position`
                     FROM BDSM
                     WHERE `user` IN @userIds
                 ) ranked
                 WHERE `position` = 1
                 """,
                new { userIds },
                cancellationToken: cancellationToken)
            );

        return ToResults(rows);
    }

    // Read only, and only the score: the `data` blob is YEPPBot's own payload in a format this side
    // has no reader for. Asking by the two id lists keeps it to one round trip at the cost of
    // answering with pairs nobody asked about, which the caller filters back down.
    public async Task<IReadOnlyList<BdsmCachedMatch>> GetCachedMatchesAsync(IReadOnlyCollection<string> resultIds, IReadOnlyCollection<string> partnerIds, CancellationToken cancellationToken)
    {
        if (resultIds.Count is 0 || partnerIds.Count is 0) return [];

        var rows = await connection.QueryAsync<BdsmCachedMatch>(
            new CommandDefinition(
                "SELECT id AS ResultId, partner AS PartnerId, score AS Score FROM MatchCache WHERE id IN @resultIds AND partner IN @partnerIds",
                new { resultIds, partnerIds },
                cancellationToken: cancellationToken)
            );

        return [.. rows];
    }

    private static IReadOnlyList<BdsmResult> ToResults(IEnumerable<dynamic> rows)
    {
        return [.. rows.Cast<IDictionary<string, object>>().Select(ToResult)];
    }

    private static BdsmResult ToResult(IDictionary<string, object> row)
    {
        var traits = new Dictionary<string, double>(BdsmTraits.All.Count, StringComparer.Ordinal);
        foreach (var trait in BdsmTraits.All)
        {
            traits[trait] = Convert.ToDouble(row[trait], CultureInfo.InvariantCulture);
        }

        var timestamp = DateTime.SpecifyKind(Convert.ToDateTime(row["timestamp"], CultureInfo.InvariantCulture), DateTimeKind.Utc);

        return new BdsmResult(
            (string) row["id"],
            Convert.ToInt32(row["user"], CultureInfo.InvariantCulture),
            timestamp,
            Convert.ToInt32(row["version"], CultureInfo.InvariantCulture),
            (string) row["gender"],
            (string) row["ageGroup"],
            traits);
    }
}
