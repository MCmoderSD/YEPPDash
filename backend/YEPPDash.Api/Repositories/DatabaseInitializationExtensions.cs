using Dapper;
using MySqlConnector;

namespace YEPPDash.Api.Repositories;

public static class DatabaseInitializationExtensions
{
    public static async Task InitializeYeppDashDatabaseAsync(this IServiceProvider services, string dbTarget)
    {
        using var scope = services.CreateScope();

        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("YEPPDash.Api.Repositories");
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
