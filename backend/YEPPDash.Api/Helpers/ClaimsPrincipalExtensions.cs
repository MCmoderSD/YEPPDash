using System.Security.Claims;
using YEPPDash.Api.Auth;
using YEPPDash.Api.Contracts;

namespace YEPPDash.Api.Helpers;

public static class ClaimsPrincipalExtensions
{
    public static string? GetTwitchId(this ClaimsPrincipal user)
    {
        return user.FindFirst(TwitchClaimTypes.TwitchId)?.Value;
    }

    // Last resort for /api/auth/me when Twitch itself cannot be reached: renders the session from
    // the cookie alone. Display name, e-mail and avatar are unavailable that way — by design,
    // since stale values would be worse than none.
    public static UserInfo? ToCachedUserInfo(this ClaimsPrincipal user)
    {
        var twitchId = user.GetTwitchId();
        var login = user.FindFirst(TwitchClaimTypes.Login)?.Value;

        if (twitchId is null || login is null)
        {
            return null;
        }

        return new UserInfo(twitchId, login, login, null, null);
    }
}
