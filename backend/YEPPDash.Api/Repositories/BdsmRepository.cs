using System.Globalization;
using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data;

namespace YEPPDash.Api.Repositories;

/// <summary>
/// Reads YEPPBot's BDSM table. The table is owned by the bot, so nothing here creates or migrates it
/// — it is expected to exist already.
/// </summary>
/// <remarks>
/// Read-only on purpose: results are written by the bot when a user submits a test, and the dashboard
/// only ever shows them back.
/// </remarks>
public sealed class BdsmRepository(MySqlConnection connection)
{
    /// <remarks>
    /// Built from <see cref="BdsmTraits.All"/> rather than written out, so the trait set lives in one
    /// place. Every name is quoted because several of them — <c>switch</c>, <c>owner</c>, <c>user</c>
    /// — read as keywords, and the <c>data</c> blob is left out: it is the largest column in the table
    /// and nothing in the dashboard shows it.
    /// </remarks>
    private static readonly string Columns = string.Join(
        ", ",
        new[] { "id", "`user`", "`timestamp`", "version", "gender", "ageGroup" }
            .Concat(BdsmTraits.All.Select(trait => $"`{trait}`")));

    /// <summary>
    /// Every test the given user has taken, newest first.
    /// </summary>
    public async Task<IReadOnlyList<BdsmResult>> GetForUserAsync(int userId, CancellationToken cancellationToken)
    {
        var rows = await connection.QueryAsync(
            new CommandDefinition(
                $"SELECT {Columns} FROM BDSM WHERE `user` = @userId ORDER BY `timestamp` DESC, id DESC",
                new { userId },
                cancellationToken: cancellationToken));

        return ToResults(rows);
    }

    /// <summary>
    /// The most recent test of every user who has taken one, across all of YEPPBot's users — the
    /// table has no channel column.
    /// </summary>
    /// <remarks>
    /// One row per user rather than the whole history: this feeds a list of people, and a user who
    /// retook the test five times would otherwise crowd out five others. The id breaks ties so that
    /// two tests submitted in the same second still pick the same winner every time.
    /// </remarks>
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
        return rows.Cast<IDictionary<string, object>>().Select(ToResult).ToList();
    }

    /// <remarks>
    /// Mapped by hand off a dictionary row rather than through a row class, because a row class would
    /// mean spelling all twenty-five traits out a second time. <see cref="Convert"/> rather than casts
    /// for the numbers: the widths MySQL hands back are its own business, and a DOUBLE column that
    /// happens to hold a whole number is not guaranteed to arrive boxed as one.
    /// </remarks>
    private static BdsmResult ToResult(IDictionary<string, object> row)
    {
        var traits = new Dictionary<string, double>(BdsmTraits.All.Count, StringComparer.Ordinal);
        foreach (var trait in BdsmTraits.All)
        {
            traits[trait] = Convert.ToDouble(row[trait], CultureInfo.InvariantCulture);
        }

        // TIMESTAMP columns come back without a kind, and MySQL stores them in UTC, so saying so here
        // keeps the offset off the wire instead of letting it be read as the server's local time.
        var timestamp = DateTime.SpecifyKind(
            Convert.ToDateTime(row["timestamp"], CultureInfo.InvariantCulture), DateTimeKind.Utc);

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
