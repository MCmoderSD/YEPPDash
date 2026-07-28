using Microsoft.AspNetCore.Authentication.Cookies;
using YEPPDash.Api.Data;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Auth;

public static class AuthServiceCollectionExtensions
{
    public static IServiceCollection AddYeppDashAuth(
        this IServiceCollection services, IConfiguration configuration, string dbTarget)
    {
        // Dashboard and bot share one Twitch app per environment, so the credentials are selected
        // by the same DbTarget switch that picks the database.
        var options = new TwitchAuthOptions
        {
            ClientId = configuration.GetRequiredValue($"Twitch:ClientId{dbTarget}", $"dbTarget '{dbTarget}'"),
            ClientSecret = configuration.GetRequiredValue($"Twitch:ClientSecret{dbTarget}", $"dbTarget '{dbTarget}'"),
            RedirectUri = configuration.GetRequiredValue("Twitch:RedirectUri"),
            Scopes = TwitchScopes.For(dbTarget)
        };

        services.AddSingleton(options);
        services.AddSingleton<ITokenCipher>(new AesGcmTokenCipher(options.ClientSecret));
        services.AddScoped<TwitchAuthService>();

        // Typed clients: the HttpClient comes from the factory, TwitchAuthOptions is filled in from
        // DI by the default activator — no manual wiring needed.
        services.AddHttpClient<TwitchOAuthClient>(client =>
        {
            client.BaseAddress = new Uri(TwitchOAuthClient.BaseUrl);
        });

        services.AddHttpClient<TwitchApiClient>(client =>
        {
            client.BaseAddress = new Uri(TwitchApiClient.BaseUrl);
        });

        AddTokenStore(services, configuration, dbTarget);

        // Cookie-only: the session is ours, Twitch is just where it came from. No challenge scheme
        // is registered, so an unauthenticated request can never trigger a redirect to Twitch by
        // accident — /api/auth/login is the one and only entry point into the flow.
        //
        // SameSite=Lax is enough in every environment: frontend and backend share a registrable
        // domain (dash./api.yeppbot.com in production, localhost in development), which makes them
        // same-site, and the OAuth callback is a top-level GET that Lax permits.
        services
            .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(cookieOptions =>
            {
                cookieOptions.Cookie.Name = "yeppdash.session";
                cookieOptions.Cookie.HttpOnly = true;
                cookieOptions.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                cookieOptions.Cookie.SameSite = SameSiteMode.Lax;
                cookieOptions.SlidingExpiration = true;
                cookieOptions.ExpireTimeSpan = TimeSpan.FromDays(14);

                // Same reasoning as /api/auth/me: this is an API, so answer with status codes
                // instead of redirecting to a login page that does not exist here.
                cookieOptions.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                cookieOptions.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
            });

        return services;
    }

    private static void AddTokenStore(IServiceCollection services, IConfiguration configuration, string dbTarget)
    {
        var connectionString = configuration.GetYeppDashConnectionString(dbTarget);

        if (string.IsNullOrEmpty(connectionString))
        {
            services.AddSingleton<ITwitchTokenStore, InMemoryTwitchTokenStore>();
            return;
        }

        services.AddSingleton(new YeppDashConnectionFactory(connectionString));
        services.AddScoped<ITwitchTokenStore, DatabaseTwitchTokenStore>();
    }
}
