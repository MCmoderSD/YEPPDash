using System.Security.Claims;
using YEPPDash.Api.Auth;

namespace YEPPDash.Api.Helpers;

public static class ClaimsPrincipalExtensions
{
    extension(ClaimsPrincipal user)
    {
        public string? GetTwitchId()
        {
            return user.FindFirst(TwitchClaimTypes.TwitchId)?.Value;
        }
    }
}