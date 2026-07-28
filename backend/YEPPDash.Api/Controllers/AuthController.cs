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
    // Step 1: hand the browser off to Twitch. The return URL travels in the state cookie rather
    // than through Twitch, so nothing user-controlled has to survive the round-trip.
    [HttpGet("login")]
    public IActionResult Login(string? returnUrl)
    {
        var target = IsAllowedReturnUrl(returnUrl) ? returnUrl : null;
        var state = OAuthStateCookie.Issue(Response, target);

        return Redirect(authService.BuildLoginUrl(state));
    }

    // Step 2: Twitch redirects back here with ?code=&state=. This is the URI registered in the
    // Twitch developer console.
    [HttpGet("callback")]
    public async Task<IActionResult> Callback(
        [FromQuery] string? code,
        [FromQuery] string? state,
        [FromQuery] string? error,
        [FromQuery(Name = "error_description")] string? errorDescription,
        CancellationToken cancellationToken)
    {
        // The state cookie is consumed no matter how this turns out — it is single-use.
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
            logger.LogWarning(
                exception, "Login via Twitch failed ({StatusCode}): {Body}", exception.StatusCode, exception.ResponseBody);

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

    // Intentionally without [Authorize]: an unauthenticated call has to answer 401 so the
    // frontend's fetch can read it. [Authorize] would instead start a redirect chain to Twitch.
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
                // Cookie is intact but the Twitch grant behind it is gone — the session is worthless.
                logger.LogInformation("Session for {TwitchId} has no usable Twitch token, signing out", twitchId);
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return Unauthorized();
            }

            logger.LogInformation("Session recognized via cookie for {TwitchId} ({Login})", twitchId, user.Login);
            return Ok(user);
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            // Twitch being down must not log everyone out; serve what the cookie knows instead.
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

    // Failure paths land back on the frontend with an error code instead of showing raw JSON.
    // The first allowed origin is the frontend by definition — it is the only one the login flow
    // is ever permitted to return to.
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
