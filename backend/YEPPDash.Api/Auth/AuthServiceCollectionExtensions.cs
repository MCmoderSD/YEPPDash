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
                // Prod is same-site (https dash./api.yeppbot.* share a registrable domain), so Lax
                // applies there and still blocks cross-site CSRF. Dev is now same-site too — both
                // servers run https on localhost — but keeps None as a safety net, since a dev
                // server on a differing scheme would silently make the pair *cross*-site under
                // schemeful same-site and drop the cookie from every /api/auth/me fetch. Safe
                // because None requires Secure, set above. Can be tightened to Lax once the local
                // login round-trip is confirmed stable.
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
                    // Fires once Twitch's id_token has been validated — a fresh, successful
                    // Twitch login (as opposed to an existing cookie just being recognized,
                    // logged separately in AuthController.Me()).
                    OnTokenValidated = context =>
                    {
                        var logger = GetLogger(context.HttpContext);
                        var twitchId = context.Principal?.FindFirst("sub")?.Value;
                        var login = context.Principal?.FindFirst("preferred_username")?.Value;
                        logger.LogInformation("Login succeeded via Twitch for {TwitchId} ({Login})", twitchId, login);
                        return Task.CompletedTask;
                    },
                    // Fires when the callback round-trip itself fails (state/nonce mismatch,
                    // token exchange error, Twitch returned an OAuth error, ...).
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

    // Auth events run outside normal DI-constructor code, so the logger has to be pulled from
    // the current request's service provider instead of being injected.
    private static ILogger GetLogger(HttpContext httpContext)
    {
        return httpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("YEPPDash.Api.Auth");
    }
}
