using Microsoft.Extensions.Diagnostics.HealthChecks;
using MySqlConnector;

namespace YEPPDash.Api.Data;

public sealed class DatabaseHealthCheck(MySqlConnection connection) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            await connection.OpenAsync(cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Database connection failed.", ex);
        }
    }
}
