namespace YEPPDash.Api.Auth;

// Short, self-chosen claim names. With the OIDC middleware gone there is no id_token whose claim
// names have to be mirrored, so there is also no reason for the long WS-Federation URIs that
// ClaimTypes.* would bring along.
public static class TwitchClaimTypes
{
    public const string TwitchId = "twitch_id";
    public const string Login = "twitch_login";
}
