using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Auth;

public static class AuthServiceCollectionExtensions
{
    public static IServiceCollection AddYeppDashAuth(this IServiceCollection services, IConfiguration configuration, IWebHostEnvironment environment, string dbTarget)
    {
        var clientId = configuration.GetRequiredValue($"Twitch:ClientId{dbTarget}", $"dbTarget '{dbTarget}'");
        var clientSecret = configuration.GetRequiredValue($"Twitch:ClientSecret{dbTarget}", $"dbTarget '{dbTarget}'");

        services
            .AddAuthentication(options =>
            {
                options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
            })
            .AddCookie(options =>
            {
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                options.Cookie.SameSite = environment.IsDevelopment() ? SameSiteMode.None : SameSiteMode.Lax;
            })
            .AddOpenIdConnect(options =>
            {
                options.MetadataAddress = "https://id.twitch.tv/oauth2/.well-known/openid-configuration";
                options.ClientId = clientId;
                options.ClientSecret = clientSecret;
                options.ResponseType = "code";
                options.ResponseMode = "query";
                options.CallbackPath = "/api/auth/callback";
                options.SaveTokens = true;
                options.MapInboundClaims = false;
                options.TokenValidationParameters.NameClaimType = "preferred_username";
                options.Scope.Clear();
                options.Scope.Add("openid");
                options.Scope.Add("user:read:email");

                options.Events = new OpenIdConnectEvents
                {
                    OnRedirectToIdentityProvider = context =>
                    {
                        context.ProtocolMessage.SetParameter("claims", "{\"id_token\":{\"email\":null,\"preferred_username\":null}}");
                        return Task.CompletedTask;
                    },
                    OnTokenValidated = context =>
                    {
                        var logger = GetLogger(context.HttpContext);
                        var twitchId = context.Principal?.FindFirst("sub")?.Value;
                        var login = context.Principal?.FindFirst("preferred_username")?.Value;
                        logger.LogInformation("Login succeeded via Twitch for {TwitchId} ({Login})", twitchId, login);
                        return Task.CompletedTask;
                    },
                    OnRemoteFailure = context =>
                    {
                        var logger = GetLogger(context.HttpContext);
                        logger.LogWarning(context.Failure, "Login via Twitch failed");
                        return Task.CompletedTask;
                    }
                };
            });

        return services;
    }

    private static ILogger GetLogger(HttpContext httpContext)
    {
        return httpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("YEPPDash.Api.Auth");
    }
}
