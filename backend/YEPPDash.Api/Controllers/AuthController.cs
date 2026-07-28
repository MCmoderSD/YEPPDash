using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Auth;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    TwitchAuthService authService,
    IConfiguration configuration,
    ILogger<AuthController> logger) : ControllerBase
{
    [HttpGet("login")]
    public IActionResult Login(string? returnUrl)
    {
        var target = IsAllowedReturnUrl(returnUrl) ? returnUrl : null;
        var state = OAuthStateCookie.Issue(Response, target);

        return Redirect(authService.BuildLoginUrl(state));
    }

    [HttpGet("callback")]
    public async Task<IActionResult> Callback(
        [FromQuery] string? code,
        [FromQuery] string? state,
        [FromQuery] string? error,
        [FromQuery(Name = "error_description")] string? errorDescription,
        CancellationToken cancellationToken)
    {
        var stateValid = OAuthStateCookie.TryConsume(Request, Response, state, out var returnUrl);

        if (error is not null)
        {
            logger.LogInformation("Login via Twitch aborted: {Error} ({Description})", error, errorDescription);
            return RedirectToFrontend(error);
        }

        if (!stateValid)
        {
            logger.LogWarning("Login via Twitch rejected: state did not match (possible CSRF attempt)");
            return RedirectToFrontend("invalid_state");
        }

        if (string.IsNullOrEmpty(code))
        {
            logger.LogWarning("Login via Twitch rejected: callback carried no authorization code");
            return RedirectToFrontend("missing_code");
        }

        try
        {
            var (principal, _) = await authService.CompleteLoginAsync(code, cancellationToken);
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);
        }
        catch (TwitchOAuthException exception)
        {
            logger.LogWarning(exception, "Login via Twitch failed ({StatusCode}): {Body}", exception.StatusCode, exception.ResponseBody);
            return RedirectToFrontend("twitch_error");
        }

        return Redirect(IsAllowedReturnUrl(returnUrl) ? returnUrl! : "/api/auth/me");
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is not null)
        {
            logger.LogInformation("Logout for {TwitchId}", twitchId);
            await authService.SignOutAsync(twitchId, cancellationToken);
        }

        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok();
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null)
        {
            logger.LogInformation(
                "Session check failed: no valid auth cookie (origin={Origin}, cookies=[{Cookies}])",
                Request.Headers.Origin.ToString(),
                string.Join(", ", Request.Cookies.Keys));

            return Unauthorized();
        }

        try
        {
            var user = await authService.GetCurrentUserAsync(twitchId, cancellationToken);
            if (user is null)
            {
                logger.LogInformation("Session for {TwitchId} has no usable Twitch token, signing out", twitchId);
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return Unauthorized();
            }

            logger.LogInformation("Session recognized via cookie for {TwitchId} ({Login})", twitchId, user.Login);
            return Ok(user);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            logger.LogWarning(exception, "Twitch is unreachable, answering /me from cookie claims for {TwitchId}", twitchId);

            var cached = User.ToCachedUserInfo();
            return cached is not null ? Ok(cached) : Unauthorized();
        }
    }

    private bool IsAllowedReturnUrl(string? returnUrl)
    {
        return
            returnUrl is not null
            && Uri.TryCreate(returnUrl, UriKind.Absolute, out var uri)
            && configuration.GetAllowedFrontendOrigins().Contains($"{uri.Scheme}://{uri.Authority}");
    }

    private IActionResult RedirectToFrontend(string error)
    {
        var origin = configuration.GetAllowedFrontendOrigins().FirstOrDefault();
        if (origin is null)
        {
            return BadRequest($"Login failed: {error}");
        }

        return Redirect($"{origin}/?error={Uri.EscapeDataString(error)}");
    }
}
