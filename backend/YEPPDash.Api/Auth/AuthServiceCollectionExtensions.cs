using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Auth;

public static class AuthServiceCollectionExtensions
{
    // Wires up Twitch as the sole identity provider: cookie scheme as the default/protecting
    // scheme, OIDC only as the challenge scheme on /api/auth/login. ClientId/ClientSecret come
    // from the same dbTarget switch used for the database — dashboard and bot share the same
    // Twitch app identity per environment, see PLAN.md#auth.
    public static IServiceCollection AddYeppDashAuth(
        this IServiceCollection services, IConfiguration configuration, string dbTarget)
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
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
            })
            .AddOpenIdConnect(options =>
            {
                // Twitch's OIDC discovery document isn't at the conventional root path.
                options.MetadataAddress = "https://id.twitch.tv/oauth2/.well-known/openid-configuration";
                options.ClientId = clientId;
                options.ClientSecret = clientSecret;
                options.ResponseType = "code";
                // ASP.NET Core defaults to response_mode=form_post for the code flow, which
                // failed round-tripping "state" against Twitch in testing ("message.State is
                // null or empty") — forcing a plain query-string redirect fixed it.
                options.ResponseMode = "query";
                options.CallbackPath = "/api/auth/callback";
                options.SaveTokens = true;
                // By default the handler rewrites inbound OIDC claims to the long WS-Federation
                // URIs ("sub" -> ".../claims/nameidentifier" etc.), so looking them up by their
                // original OIDC names (see ClaimsPrincipalExtensions) would silently yield null.
                options.MapInboundClaims = false;
                options.TokenValidationParameters.NameClaimType = "preferred_username";
                options.Scope.Clear();
                options.Scope.Add("openid");
                // Requesting the email *claim* (below) is not enough on its own — Twitch
                // rejects that with "insufficient_scope" unless the matching Helix scope is
                // granted too. Both parts are required to get an email into the id_token.
                options.Scope.Add("user:read:email");

                options.Events = new OpenIdConnectEvents
                {
                    // Twitch only returns email/preferred_username in the id_token if the
                    // authorize request explicitly asks for them via the "claims" parameter —
                    // confirmed empirically: without preferred_username listed here, "login"
                    // came back null even though "sub" and the requested "email" worked.
                    OnRedirectToIdentityProvider = context =>
                    {
                        context.ProtocolMessage.SetParameter("claims",
                            "{\"id_token\":{\"email\":null,\"preferred_username\":null}}");
                        return Task.CompletedTask;
                    }
                };
            });

        return services;
    }
}
