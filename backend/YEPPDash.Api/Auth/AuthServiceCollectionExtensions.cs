using Microsoft.AspNetCore.Authentication.Cookies;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Services;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Auth;

public static class AuthServiceCollectionExtensions
{
    public static IServiceCollection AddYeppDashAuth(
        this IServiceCollection services, IConfiguration configuration, string dbTarget)
    {
        var options = new TwitchAuthOptions
        {
            ClientId = configuration.GetRequiredValue($"Twitch:ClientId{dbTarget}", $"dbTarget '{dbTarget}'"),
            ClientSecret = configuration.GetRequiredValue($"Twitch:ClientSecret{dbTarget}", $"dbTarget '{dbTarget}'"),
            RedirectUri = configuration.GetRequiredValue("Twitch:RedirectUri"),
            Scopes = TwitchScopes.For(dbTarget)
        };

        services.AddSingleton(options);
        services.AddSingleton<ITokenCipher>(new AesGcmTokenCipher(options.ClientSecret));
        // What YEPPBot presents on the endpoints it calls. Derived from the same secret, the same
        // way, as the key YEPPDash presents when calling the bot — one value, agreed on by both
        // halves without either configuring it.
        services.AddSingleton(new ServiceToken(options.ClientSecret));
        services.AddScoped<TwitchAuthService>();
        
        services.AddHttpClient<TwitchOAuthClient>(client =>
        {
            client.BaseAddress = new Uri(TwitchOAuthClient.BaseUrl);
        });

        services.AddHttpClient<TwitchApiClient>(client =>
        {
            client.BaseAddress = new Uri(TwitchApiClient.BaseUrl);
        });

        AddTokenStore(services, configuration, dbTarget);

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

    private static void AddTokenStore(IServiceCollection services, IConfiguration configuration, string dbTarget)
    {
        var connectionString = configuration.GetYeppDashConnectionString(dbTarget);

        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException(
                $"Missing connection string 'ConnectionStrings:YeppDash{dbTarget}' for DbTarget '{dbTarget}'. " +
                "Twitch tokens are only ever persisted, so there is nothing to fall back to.");
        }

        services.AddSingleton(new YeppDashConnectionFactory(connectionString));
        services.AddScoped<DatabaseTwitchTokenStore>();
    }
}