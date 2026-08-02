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

    public async Task<IReadOnlyList<BdsmResult>> GetLatestPerUserAsync(CancellationToken cancellationToken)
    {
        var rows = await connection.QueryAsync(
            new CommandDefinition(
                $"""
                 SELECT {Columns} FROM (
                     SELECT {Columns},
                            ROW_NUMBER() OVER (PARTITION BY `user` ORDER BY `timestamp` DESC, id DESC) AS `position`
                     FROM BDSM
                 ) ranked
                 WHERE `position` = 1
                 """,
                cancellationToken: cancellationToken));

        return ToResults(rows);
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
            (string)row["id"],
            Convert.ToInt32(row["user"], CultureInfo.InvariantCulture),
            timestamp,
            Convert.ToInt32(row["version"], CultureInfo.InvariantCulture),
            (string)row["gender"],
            (string)row["ageGroup"],
            traits);
    }
}