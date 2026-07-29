using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace YEPPDash.Api.Helpers;

public static class HealthEndpointExtensions
{
    public static WebApplication MapYeppDashHealthChecks(this WebApplication app)
    {
        // Liveness: runs no checks at all, so it answers as long as the process is accepting
        // requests. This is the one a reverse proxy or uptime monitor should poll — a slow
        // database must not make Caddy pull a working instance out of rotation.
        app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });

        // Readiness: can this instance actually serve traffic right now?
        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = registration => registration.Tags.Contains("ready"),
            ResponseWriter = WriteJsonAsync,
        });

        // Kept as the aggregate it already was, so anything pointing at /health keeps working.
        app.MapHealthChecks("/health", new HealthCheckOptions { ResponseWriter = WriteJsonAsync });

        return app;
    }

    // The default writer answers with the bare word "Unhealthy", which says nothing about which
    // dependency broke. This reports per-check status instead.
    private static Task WriteJsonAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";

        return context.Response.WriteAsync(JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            totalDurationMs = Math.Round(report.TotalDuration.TotalMilliseconds, 1),
            checks = report.Entries.Select(entry => new
            {
                name = entry.Key,
                status = entry.Value.Status.ToString(),
                durationMs = Math.Round(entry.Value.Duration.TotalMilliseconds, 1),
                description = entry.Value.Description,
            }),
        }));
    }
}
