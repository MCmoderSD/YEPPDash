using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/auth/login", (string? returnUrl) =>
            Results.Challenge(
                new AuthenticationProperties { RedirectUri = returnUrl ?? "/api/auth/me" },
                [OpenIdConnectDefaults.AuthenticationScheme]));

        app.MapPost("/api/auth/logout", async (HttpContext ctx) =>
        {
            await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok();
        });

        // No service/repository beneath this one: there's no local user store or business
        // logic yet, just reading claims Twitch already put on the cookie at login.
        app.MapGet("/api/auth/me", (ClaimsPrincipal user) => Results.Ok(user.ToUserInfo()))
            .RequireAuthorization();

        return app;
    }
}
