using System.Globalization;
using Dapper;
using MCmoderSD.BdsmTestApi.Enums;
using MySqlConnector;
using YEPPDash.Api.Data.Bdsm;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Repositories;

public sealed class BdsmRepository(MySqlConnection connection)
{
    private static readonly string Columns = string.Join(", ", new[] { "id", "`user`", "`timestamp`", "version", "gender", "ageGroup" }.Concat(BdsmTraits.All.Select(kink => $"`{BdsmTraits.Column(kink)}`")));

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
        var traits = new Dictionary<Kink, double>(BdsmTraits.All.Count);
        foreach (var kink in BdsmTraits.All)
        {
            traits[kink] = Convert.ToDouble(row[BdsmTraits.Column(kink)], CultureInfo.InvariantCulture);
        }

        var timestamp = Convert.ToDateTime(row["timestamp"], CultureInfo.InvariantCulture).AsUtc();

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