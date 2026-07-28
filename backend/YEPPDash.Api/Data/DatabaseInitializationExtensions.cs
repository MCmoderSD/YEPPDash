using Dapper;
using MySqlConnector;

namespace YEPPDash.Api.Data;

public static class DatabaseInitializationExtensions
{
    // Creates the dashboard-owned tables if they are missing — the same self-provisioning approach
    // Helix-API uses for its own RefreshToken table. Only ever touches YEPPDash's database; the
    // `helix` schema is read-only from here and stays untouched.
    //
    // Configuring a connection string and then not being able to use it is always a deployment
    // bug, so it fails fast instead of quietly degrading to the in-memory store — losing every
    // session on restart without anyone noticing would be the worse outcome.
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

        try
        {
            await using var connection = connections.Create();
            await connection.ExecuteAsync(DatabaseTwitchTokenStore.CreateTableSql);
        }
        catch (MySqlException exception)
        {
            throw new InvalidOperationException(
                $"Cannot use 'ConnectionStrings:YeppDash{dbTarget}': {exception.Message} " +
                "The configured user needs CREATE, SELECT, INSERT, UPDATE and DELETE on the YEPPDash database. " +
                "Remove the connection string to fall back to the in-memory token store.",
                exception);
        }

        logger.LogInformation("YEPPDash database ready, Twitch tokens are persisted");
    }
}
