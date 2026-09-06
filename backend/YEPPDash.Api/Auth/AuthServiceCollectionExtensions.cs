using Microsoft.AspNetCore.Authentication.Cookies;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Services;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Auth;

public static class AuthServiceCollectionExtensions
{
    public static IServiceCollection AddYeppDashAuth(
        this IServiceCollection services, IConfiguration configuration, string environmentName, DatabaseOptions database)
    {
        var options = new TwitchAuthOptions
        {
            ClientId = configuration.GetRequiredValue("Twitch:ClientId"),
            ClientSecret = configuration.GetRequiredValue("Twitch:ClientSecret"),
            RedirectUri = configuration.GetRequiredValue($"Twitch:RedirectUri:{environmentName}"),
            Scopes = TwitchScopes.For(environmentName)
        };

        services.AddSingleton(options);
        services.AddSingleton<ITokenCipher>(new AesGcmTokenCipher(options.ClientSecret));
        services.AddScoped<TwitchAuthService>();
        
        services.AddHttpClient<TwitchOAuthClient>(client =>
        {
            client.BaseAddress = new Uri(TwitchOAuthClient.BaseUrl);
        });

        services.AddHttpClient<TwitchApiClient>(client =>
        {
            client.BaseAddress = new Uri(TwitchApiClient.BaseUrl);
        });

        AddTokenStore(services, database);

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

    // Twitch tokens are only ever persisted, never held in memory, so a token store that cannot
    // reach its database is not something to start up without. DatabaseOptions.From has already
    // refused anything half-configured by the time this runs.
    private static void AddTokenStore(IServiceCollection services, DatabaseOptions database)
    {
        services.AddSingleton(new YeppDashConnectionFactory(database.YeppDashConnectionString));
        services.AddScoped<DatabaseTwitchTokenStore>();
    }
}