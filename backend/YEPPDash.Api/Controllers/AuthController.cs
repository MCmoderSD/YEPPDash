using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IConfiguration configuration, ILogger<AuthController> logger) : ControllerBase
{
    [HttpGet("login")]
    public IActionResult Login(string? returnUrl)
    {
        var challenge = Challenge(
            new AuthenticationProperties
            {
                RedirectUri = IsAllowedReturnUrl(returnUrl, configuration.GetAllowedFrontendOrigins())
                    ? returnUrl!
                    : "/api/auth/me"
            },
            OpenIdConnectDefaults.AuthenticationScheme);

        return challenge;
    }


    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok();
    }


    [HttpGet("me")]
    public IActionResult Me()
    {
        var authorized = User.Identity?.IsAuthenticated == true;

        if (authorized)
        {
            var twitchId = User.FindFirst("sub")?.Value;
            logger.LogInformation("Session recognized via cookie for {TwitchId}", twitchId);
        }
        else
        {
            // Logged too, so "the browser never sent a cookie" stays distinguishable from
            // "the request never arrived" when a login round-trip misbehaves. The cookie names
            // separate "browser attached nothing" from "cookie arrived but was rejected".
            logger.LogInformation(
                "Session check failed: no valid auth cookie (origin={Origin}, cookies=[{Cookies}])",
                Request.Headers.Origin.ToString(),
                string.Join(", ", Request.Cookies.Keys));
        }

        return authorized ? Ok(User.ToUserInfo()) : Unauthorized();
    }


    private static bool IsAllowedReturnUrl(string? returnUrl, string[] allowedOrigins)
    {
        return 
            returnUrl is not null
            && Uri.TryCreate(returnUrl, UriKind.Absolute, out var uri)
            && allowedOrigins.Contains($"{uri.Scheme}://{uri.Authority}");
    }
}
