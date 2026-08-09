namespace YEPPDash.Api.Data.Module;

/// <summary>
/// The built-in commands a channel can switch, hard-coded because the bot has no route that lists
/// them. Read off YEPPBot's own command classes in <c>de.MCmoderSD.commands</c>.
/// </summary>
/// <remarks>
/// The ids are the bot's command names lower-cased, which is what <c>CommandHandler</c> keys its
/// <c>commandMap</c> by and what the <c>Blacklist</c> table stores. An id the bot does not register
/// would write a row that blocks nothing, so nothing may be invented here.
///
/// This is deliberately not every command the bot registers — the ones left out (Info, Moderate,
/// Ping, RoleSwap, Say, Status) are either how the channel is administered or too small to be worth
/// switching, and a channel that blocked Moderate would lose the chat-side way to unblock anything.
/// </remarks>
public static class BotModuleCatalog
{
    public static IReadOnlyList<BotModule> All { get; } =
    [
        new("bdsm", "BDSM Test",
            "Chatters save their result from bdsmtest.org and compare it with everyone else in the "
            + "channel — who matches whom, and who scores highest on a given trait.",
            ["bdsm-test", "kink"],
            [
                new("!bdsm set <test-id>", "Saves your result. The id is the code at the end of your bdsmtest.org result link."),
                new("!bdsm get <@user>", "Reads back the traits somebody has already saved."),
                new("!bdsm match <@user>", "How compatible the two of you are, as a percentage."),
                new("!bdsm match top <amount>", "Your most compatible chatters, best first."),
                new("!bdsm biggest <trait>", "Who scores highest on one trait, e.g. brat, sadist, switch, vanilla."),
            ]),

        new("birthday", "Birthday",
            "Keeps a birthday for each chatter so the bot knows whose is coming up. Only people "
            + "connected to your channel are counted — followers, subs, VIPs, mods and chatters.",
            ["bday", "geburtstag", "bd", "geb", "gb"],
            [
                new("!birthday set <DD.MM.YYYY>", "Saves your birthday, e.g. 24.12.1998."),
                new("!birthday delete", "Removes it again."),
                new("!birthday get <user>", "Looks up somebody else's."),
                new("!birthday until", "How many days are left until yours."),
                new("!birthday in <month>", "Everyone with a birthday in that month. Takes a name or a number."),
                new("!birthday next <amount>", "The birthdays coming up soonest."),
            ]),

        new("chatgpt", "ChatGPT",
            "Chatters talk to ChatGPT in your chat. The bot remembers each person's thread, so "
            + "follow-up questions carry on from the last answer until they clear it.",
            ["conversation", "gpt", "ai"],
            [
                new("!chatgpt <message>", "Asks a question and answers in chat."),
                new("!chatgpt reset", "Forgets your thread and starts over."),
            ]),

        new("help", "Help",
            "Lists the commands your channel actually has, blocked ones left out, and explains any "
            + "one of them on request.",
            ["hilfe"],
            [
                new("!help", "Lists every command available in this channel."),
                new("!help <command>", "Explains one command and what it is for."),
            ]),

        new("lurk", "Lurk",
            "Lets chatters say they are still around but not watching. The bot times how long they "
            + "were gone and says so when they come back — and calls them out if it spots them "
            + "chatting in somebody else's channel meanwhile.",
            ["lörk", "lürk", "lork", "afk"],
            [
                new("!lurk", "Marks you as lurking. Takes nothing else."),
            ]),

        new("queue", "Queue",
            "A waiting list for the channel, so viewers who want to play with you line up in order "
            + "instead of asking over and over. Still being worked on.",
            ["warteliste", "warteschlange"],
            [
                new("!queue", "Puts you in the line and tells you your position."),
                new("!queue leave", "Takes you back out."),
                new("!queue list", "Shows the whole line, in order."),
                new("!queue next", "Who is up next, and how long they have waited."),
                new("!queue dequeue <@user>", "Removes somebody, or the next in line if you name nobody.", Moderators: true),
                new("!queue clear", "Empties the whole line.", Moderators: true),
            ]),

        new("quote", "Quote",
            "Saves the lines your chat wants to keep and reads them back later, at random or by "
            + "number. The same quotes the Quotes page manages.",
            ["qoute", "zitat", "gänsehosen"],
            [
                new("!quote", "A random one."),
                new("!quote <number>", "A specific one, e.g. !quote 7."),
                new("!quote first", "The oldest one saved."),
                new("!quote last", "The newest one saved."),
                new("!quote add <text>", "Saves a new one.", Moderators: true),
                new("!quote edit <number> <text>", "Rewrites one that already exists.", Moderators: true),
                new("!quote delete <number>", "Removes one.", Moderators: true),
            ]),

        new("shoutout", "Shoutout",
            "Points your chat at another streamer, with Twitch's own shoutout. Can also fire by "
            + "itself whenever somebody raids you. Moderators only, all of it.",
            ["so"],
            [
                new("!shoutout", "Shouts out whoever raided you last.", Moderators: true),
                new("!shoutout <@user>", "Shouts out somebody you name.", Moderators: true),
                new("!shoutout enable", "Shouts out every raider automatically from now on.", Moderators: true),
                new("!shoutout disable", "Stops doing that.", Moderators: true),
            ]),

        new("weather", "Weather",
            "Reads out the current weather for any city — temperature, wind, sunrise and sunset — "
            + "written as one plain sentence.",
            ["wetter", "wetterbericht"],
            [
                new("!weather <city>", "The weather there, answered in German."),
                new("!weather <city>, <language>", "The same in another language, e.g. !weather Tokyo, English."),
            ]),
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
