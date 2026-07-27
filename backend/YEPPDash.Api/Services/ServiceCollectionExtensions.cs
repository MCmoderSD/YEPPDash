namespace YEPPDash.Api.Services;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddYeppDashServices(this IServiceCollection services)
    {
        services.AddScoped<IDiagnosticsService, DiagnosticsService>();
        return services;
    }
}
