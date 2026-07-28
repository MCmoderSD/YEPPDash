using System.Security.Claims;
using YEPPDash.Api.Contracts;

namespace YEPPDash.Api.Helpers;

public static class ClaimsPrincipalExtensions
{
    public static UserInfo ToUserInfo(this ClaimsPrincipal user)
    {
        var info = new UserInfo(
            user.FindFirst("sub")?.Value,
            user.FindFirst("preferred_username")?.Value,
            user.FindFirst("email")?.Value
        );
        
        return info;
    } 
}
