using Dapper;
using MySqlConnector;

namespace YEPPDash.Api.Repositories;

public static class DatabaseInitializationExtensions
{
    public static async Task InitializeYeppDashDatabaseAsync(this IServiceProvider services, string dbTarget)
    {
        using var scope = services.CreateScope();

        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("YEPPDash.Api.Repositories");
        var connections = scope.ServiceProvider.GetRequiredService<YeppDashConnectionFactory>();

        try
        {
            await using var connection = connections.Create();
            await connection.ExecuteAsync(DatabaseTwitchTokenStore.CreateTableSql);
            await connection.ExecuteAsync(WheelRepository.CreateTableSql);
            await connection.ExecuteAsync(TimeoutRewardRepository.CreateTableSql);
            await connection.ExecuteAsync(GiveawayRepository.CreateTableSql);
            await connection.ExecuteAsync(RedemptionLogRepository.CreateTableSql);
        }
        catch (MySqlException exception)
        {
            throw new InvalidOperationException(
                $"Cannot use 'ConnectionStrings:YeppDash{dbTarget}': {exception.Message} " +
                "The configured user needs CREATE, SELECT, INSERT, UPDATE and DELETE on the YEPPDash database.",
                exception);
        }

        logger.LogInformation("YEPPDash database ready, Twitch tokens are persisted");
    }
}