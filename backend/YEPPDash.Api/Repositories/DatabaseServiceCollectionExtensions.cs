using Dapper;
using MySqlConnector;

namespace YEPPDash.Api.Repositories;

public static class DatabaseServiceCollectionExtensions
{
    public static IServiceCollection AddYeppDashDatabase(this IServiceCollection services, DatabaseOptions database)
    {
        var connectionString = database.YeppBotConnectionString;

        services.AddTransient<MySqlConnection>(_ => new MySqlConnection(connectionString));

        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

        SqlMapper.AddTypeHandler(new BitBoolTypeHandler());

        return services;
    }
}