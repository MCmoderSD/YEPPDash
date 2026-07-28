using System.Security.Claims;
using YEPPDash.Api.Auth;
using YEPPDash.Api.Contracts;

namespace YEPPDash.Api.Helpers;

public static class ClaimsPrincipalExtensions
{
    extension(ClaimsPrincipal user)
    {
        public string? GetTwitchId()
        {
            return user.FindFirst(TwitchClaimTypes.TwitchId)?.Value;
        }

        public UserInfo? ToCachedUserInfo()
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
}
