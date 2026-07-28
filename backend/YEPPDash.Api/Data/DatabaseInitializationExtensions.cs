using Dapper;

namespace YEPPDash.Api.Data;

public static class DatabaseInitializationExtensions
{
    // Creates the dashboard-owned tables if they are missing — the same self-provisioning approach
    // Helix-API uses for its own RefreshToken table. Only ever touches YEPPDash's database; the
    // `helix` schema is read-only from here and stays untouched.
    public static async Task InitializeYeppDashDatabaseAsync(this IServiceProvider services, string dbTarget)
    {
        using var scope = services.CreateScope();

        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("YEPPDash.Api.Data");
        var connections = scope.ServiceProvider.GetService<YeppDashConnectionFactory>();

        if (connections is null)
        {
            logger.LogWarning(
                "No connection string 'ConnectionStrings:YeppDash{DbTarget}' configured — Twitch tokens are kept " +
                "in memory and are lost on restart. Configure it to persist them.",
                dbTarget);

            return;
        }

        await using var connection = connections.Create();
        await connection.ExecuteAsync(DatabaseTwitchTokenStore.CreateTableSql);

        logger.LogInformation("YEPPDash database ready, Twitch tokens are persisted");
    }
}
