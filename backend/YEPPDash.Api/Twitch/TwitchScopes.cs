namespace YEPPDash.Api.Twitch;

// Scope sets, one per environment, mirroring the two Twitch apps YEPPBot already uses. They are
// intentionally different: the Prod app asks for the minimum YEPPBot actually needs in production,
// the Dev app asks for Twitch's complete catalogue so new bot features can be tried out without a
// re-authorization round.
//
// Dashboard and bot share one app per environment, so a single consent covers both — a user who
// logs into the dashboard has thereby granted the bot everything it needs on their channel.
public static class TwitchScopes
{
    public static string[] For(string dbTarget)
    {
        return dbTarget.Equals("Prod", StringComparison.OrdinalIgnoreCase) ? Prod : Dev;
    }

    // Exactly the 13 scopes YEPPBot's production app requests.
    public static readonly string[] Prod =
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

    // All 80 scopes Twitch currently defines — the Dev app deliberately grants everything.
    public static readonly string[] Dev =
    [
        "user:manage:chat_color",
        "channel:read:stream_key",
        "user:read:whispers",
        "moderator:read:vips",
        "moderator:read:blocked_terms",
        "moderator:manage:chat_messages",
        "channel:manage:ads",
        "channel:read:predictions",
        "channel:read:redemptions",
        "channel:read:guest_star",
        "channel:manage:raids",
        "editor:manage:clips",
        "channel:read:charity",
        "channel:read:editors",
        "channel:moderate",
        "channel:read:subscriptions",
        "chat:edit",
        "moderator:read:warnings",
        "moderator:manage:shoutouts",
        "channel:read:vips",
        "moderator:read:followers",
        "moderator:manage:unban_requests",
        "channel:manage:vips",
        "moderator:read:banned_users",
        "moderator:manage:chat_settings",
        "moderator:read:guest_star",
        "channel:read:goals",
        "moderator:read:chat_settings",
        "moderation:read",
        "user:read:emotes",
        "user:read:follows",
        "channel:manage:extensions",
        "chat:read",
        "moderator:read:suspicious_users",
        "user:read:email",
        "channel:manage:predictions",
        "channel:manage:clips",
        "channel:read:polls",
        "channel:manage:schedule",
        "analytics:read:games",
        "channel:manage:videos",
        "moderator:manage:announcements",
        "user:edit:broadcast",
        "moderator:manage:banned_users",
        "moderator:manage:blocked_terms",
        "moderator:manage:guest_star",
        "user:read:subscriptions",
        "moderator:manage:automod_settings",
        "channel:manage:guest_star",
        "moderator:read:shoutouts",
        "analytics:read:extensions",
        "user:write:chat",
        "user:read:blocked_users",
        "moderator:manage:automod",
        "user:read:chat",
        "channel:read:hype_train",
        "channel:edit:commercial",
        "channel:manage:redemptions",
        "user:manage:blocked_users",
        "moderator:read:moderators",
        "channel:manage:moderators",
        "moderator:read:chatters",
        "moderator:manage:shield_mode",
        "channel:manage:broadcast",
        "moderator:read:chat_messages",
        "moderator:read:unban_requests",
        "user:manage:whispers",
        "clips:edit",
        "user:bot",
        "user:edit",
        "user:read:moderated_channels",
        "moderator:manage:warnings",
        "moderator:read:automod_settings",
        "bits:read",
        "whispers:read",
        "channel:read:ads",
        "channel:bot",
        "user:read:broadcast",
        "channel:manage:polls",
        "moderator:read:shield_mode"
    ];
}
