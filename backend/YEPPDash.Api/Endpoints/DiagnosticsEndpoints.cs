using YEPPDash.Api.Services;

namespace YEPPDash.Api.Endpoints;

public static class DiagnosticsEndpoints
{
    public static IEndpointRouteBuilder MapDiagnosticsEndpoints(this IEndpointRouteBuilder app)
    {
        // Throwaway diagnostic endpoint (ROADMAP Phase 0, step 10) — verifies the
        // least-privilege read-only DB user connects and that Channel.active/autoShoutout
        // map cleanly to bool via BitBoolTypeHandler.
        app.MapGet("/api/_internal/dbcheck", async (IDiagnosticsService diagnostics) =>
            Results.Ok(await diagnostics.GetSampleChannelsAsync()));

        return app;
    }
}
