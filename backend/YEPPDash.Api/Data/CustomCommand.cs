namespace YEPPDash.Api.Data;

/// <summary>
/// A command a channel taught YEPPBot itself: somebody types <c>!name</c> in chat and the bot
/// answers with <paramref name="Message"/>.
/// </summary>
/// <param name="Name">
/// The trigger, without the <c>!</c> prefix. Unique within the channel, and compared without
/// regard to case — chat does not distinguish <c>!Hug</c> from <c>!hug</c>.
/// </param>
/// <param name="Aliases">
/// Further triggers for the same message. A set: duplicates are dropped and case is ignored, but
/// the order the channel entered them in is kept so the list does not reshuffle between reads.
/// </param>
/// <param name="Active">Whether the bot currently answers to it. An inactive command is kept, not run.</param>
/// <param name="ResponseType">How the bot puts the message in chat.</param>
/// <param name="UserLevel">The lowest rank allowed to run it.</param>
public sealed record CustomCommand(
    string Name,
    IReadOnlyList<string> Aliases,
    string Message,
    bool Active,
    CommandResponseType ResponseType,
    CommandUserLevel UserLevel)
{
    /// <summary>Every word this command answers to, its name first.</summary>
    public IEnumerable<string> Triggers => Aliases.Prepend(Name);
}

public static class CustomCommandLimits
{
    // Matches the ceiling the quotes already use, and the one the table will carry once it exists.
    public const int MaxLength = 500;
}
