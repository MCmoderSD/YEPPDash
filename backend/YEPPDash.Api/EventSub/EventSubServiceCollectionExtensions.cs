namespace YEPPDash.Api.EventSub;

public static class EventSubServiceCollectionExtensions
{
    public static IServiceCollection AddYeppDashEventSub(this IServiceCollection services)
    {
        services.AddSingleton<EventSubSocket>();
        services.AddSingleton<EventSubHost>();
        services.AddHostedService(provider => provider.GetRequiredService<EventSubHost>());

        return services;
    }
}