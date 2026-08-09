namespace YEPPDash.Api.Data.Module;

/// <summary>
/// The built-in commands YEPPBot registers at startup, hard-coded because the bot has no route that
/// lists them. Mirrors the <c>new X(this)</c> block in YEPPBot's <c>TwitchBot</c>.
/// </summary>
/// <remarks>
/// The ids are the bot's own command names lower-cased, which is what <c>CommandHandler</c> keys its
/// <c>commandMap</c> by and what the <c>Blacklist</c> table stores. A module missing here is simply
/// not offered; an id that the bot does not register would write a row that blocks nothing, which is
/// why this list is kept to what <c>TwitchBot</c> actually constructs — <c>Match</c> is commented out
/// there and is therefore absent here too.
/// </remarks>
public static class BotModuleCatalog
{
    public static IReadOnlyList<BotModule> All { get; } =
    [
        new("bdsm", "BDSM Test", "Records and reads back BDSM test results.", ["bdsm-test", "kink"]),
        new("birthday", "Birthday", "Lets chatters set their birthday and announces them.", ["bday", "geburtstag", "bd", "geb", "gb"]),
        new("chatgpt", "ChatGPT", "Answers chatters through ChatGPT.", ["conversation", "gpt", "ai"]),
        new("help", "Help", "Lists the bot's commands, or explains one of them.", ["hilfe"]),
        new("info", "Info", "Shows a channel's moderators, editors and VIPs.", ["information"]),
        new("lurk", "Lurk", "Lets chatters mark themselves as lurking.", ["lörk", "lürk", "lork", "afk"]),
        new("moderate", "Moderate", "Changes the bot's per-channel settings from chat.", ["mod", "moderrate", "modderate", "modderrate"]),
        new("ping", "Ping", "Answers with the bot's latency.", ["latency"]),
        new("queue", "Queue", "Runs a waiting list for the channel.", ["warteliste", "warteschlange"]),
        new("quote", "Quote", "Adds, edits and reads back channel quotes.", ["qoute", "zitat", "gänsehosen"]),
        new("roleswap", "Role Swap", "Lets moderators change a user's role.", ["rolechange", "rs"]),
        new("say", "Say", "Lets moderators send a message as the bot.", ["repeat"]),
        new("shoutout", "Shoutout", "Shouts out a raider or a named user.", ["so"]),
        new("status", "Status", "Reports whether the bot is up.", ["test"]),
        new("weather", "Weather", "Shows the current weather report.", ["wetter", "wetterbericht"]),
    ];

    private static readonly IReadOnlyDictionary<string, BotModule> ById =
        All.ToDictionary(module => module.Id, StringComparer.Ordinal);

    /// <returns><c>null</c> when no module goes by that id.</returns>
    public static BotModule? Find(string id)
    {
        // Ordinal against an already-lowered id: the Blacklist table collates utf8mb4_bin, so the
        // bot's own comparison is byte for byte and a looser match here would accept an id that
        // then writes a row the bot never reads.
        return ById.TryGetValue(id.Trim().ToLowerInvariant(), out var module) ? module : null;
    }
}
