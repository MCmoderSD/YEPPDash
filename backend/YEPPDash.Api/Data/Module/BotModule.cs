namespace YEPPDash.Api.Data.Module;

/// <summary>
/// One of YEPPBot's built-in commands, as something a channel can turn on and off.
/// </summary>
/// <param name="Id">
/// The bot's own canonical command name, lower-cased. This is the exact string the
/// <c>Blacklist</c> table stores and the bot compares against, so it is the identity here rather
/// than a key of the dashboard's own making.
/// </param>
/// <param name="Aliases">The other triggers the bot answers to. Shown, never stored — the bot
/// resolves an alias to <paramref name="Id"/> before it looks at the blacklist at all.</param>
/// <param name="Usage">How the command is actually typed, one line per thing it can do.</param>
public sealed record BotModule(
    string Id,
    string Name,
    string Description,
    IReadOnlyList<string> Aliases,
    IReadOnlyList<BotModuleUsage> Usage);

/// <param name="Syntax">The command as typed, with placeholders in angle brackets.</param>
/// <param name="Description">What that particular form does, in one short line.</param>
/// <param name="Moderators">
/// Whether the bot refuses this form to anyone below moderator. Worth showing: a chatter trying it
/// gets no reply at all rather than an error, which reads as the module being broken.
/// </param>
public sealed record BotModuleUsage(string Syntax, string Description, bool Moderators = false);
