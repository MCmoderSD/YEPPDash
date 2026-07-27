using System.Security.Claims;
using YEPPDash.Api.Contracts;

namespace YEPPDash.Api.Helpers;

public static class ClaimsPrincipalExtensions
{
    public static UserInfo ToUserInfo(this ClaimsPrincipal user) => new(
        TwitchId: user.FindFirst("sub")?.Value,
        Login: user.FindFirst("preferred_username")?.Value,
        Email: user.FindFirst("email")?.Value);
}
