using Dapper;
using MySqlConnector;

namespace YEPPDash.Api.Repositories;

public static class DatabaseServiceCollectionExtensions
{
    public static IServiceCollection AddYeppDashDatabase(
        this IServiceCollection services, IConfiguration configuration, string dbTarget)
    {
        var connectionStringKey = $"Helix{dbTarget}";
        var connectionString = configuration.GetConnectionString(connectionStringKey)
            ?? throw new InvalidOperationException(
                $"Missing connection string 'ConnectionStrings:{connectionStringKey}' for DbTarget '{dbTarget}'.");

        services.AddTransient<MySqlConnection>(_ => new MySqlConnection(connectionString));

        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

        SqlMapper.AddTypeHandler(new BitBoolTypeHandler());

        return services;
    }
}