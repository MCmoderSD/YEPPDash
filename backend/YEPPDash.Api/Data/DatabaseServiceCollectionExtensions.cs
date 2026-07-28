using Dapper;
using MySqlConnector;

namespace YEPPDash.Api.Data;

public static class DatabaseServiceCollectionExtensions
{
    // Registers the MariaDB connection for whichever server dbTarget selects (Dev: 10.10.10.1,
    // Prod: dedi.mcmodersd.de) plus its health check. Both connection strings are always
    // configured; dbTarget just picks one, so the same container image can be pointed at either
    // without a rebuild. Repositories get added here too once a feature needs one (Phase 2).
    public static IServiceCollection AddYeppDashDatabase(
        this IServiceCollection services, IConfiguration configuration, string dbTarget)
    {
        var connectionStringKey = $"Helix{dbTarget}";
        var connectionString = configuration.GetConnectionString(connectionStringKey)
            ?? throw new InvalidOperationException(
                $"Missing connection string 'ConnectionStrings:{connectionStringKey}' for DbTarget '{dbTarget}'.");

        services.AddTransient<MySqlConnection>(_ => new MySqlConnection(connectionString));
        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");

        SqlMapper.AddTypeHandler(new BitBoolTypeHandler());

        return services;
    }
}
