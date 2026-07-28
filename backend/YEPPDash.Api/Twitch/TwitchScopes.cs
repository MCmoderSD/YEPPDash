namespace YEPPDash.Api.Twitch;

// The exact scope set YEPPBot itself requests. Dashboard and bot share one Twitch app per
// environment, so a single consent covers everything the bot needs on the broadcaster's channel —
// there is no second authorization step.
public static class TwitchScopes
{
    public static readonly string[] Required =
    [
        "channel:read:vips",
        "channel:edit:commercial",
        "user:read:email",
        "channel:manage:moderators",
        "channel:manage:vips",
        "moderation:read",
        "moderator:read:followers",
        "channel:read:subscriptions",
        "moderator:read:chatters",
        "moderator:manage:chat_messages",
        "channel:read:editors",
        "channel:manage:raids",
        "moderator:manage:shoutouts"
    ];
}
