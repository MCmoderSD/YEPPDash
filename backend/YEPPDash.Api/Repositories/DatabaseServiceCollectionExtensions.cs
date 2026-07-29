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

        // Tagged "ready" so the liveness endpoint can exclude it: a database blip means this
        // instance cannot serve requests, not that the process needs restarting.
        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

        SqlMapper.AddTypeHandler(new BitBoolTypeHandler());

        return services;
    }
}