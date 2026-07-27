using Dapper;
using MySqlConnector;

namespace YEPPDash.Api.Data;

public static class DatabaseServiceCollectionExtensions
{
    // Registers the MariaDB connection for whichever server dbTarget selects (Dev: 10.10.10.1,
    // Prod: dedi.mcmodersd.de) plus the repositories built on it. Both connection strings are
    // always configured; dbTarget just picks one, so the same container image can be pointed
    // at either without a rebuild.
    public static IServiceCollection AddYeppDashDatabase(
        this IServiceCollection services, IConfiguration configuration, string dbTarget)
    {
        var connectionStringKey = $"Helix{dbTarget}";
        var connectionString = configuration.GetConnectionString(connectionStringKey)
            ?? throw new InvalidOperationException(
                $"Missing connection string 'ConnectionStrings:{connectionStringKey}' for DbTarget '{dbTarget}'.");

        services.AddTransient<MySqlConnection>(_ => new MySqlConnection(connectionString));
        services.AddScoped<IChannelRepository, ChannelRepository>();

        SqlMapper.AddTypeHandler(new BitBoolTypeHandler());

        return services;
    }
}
