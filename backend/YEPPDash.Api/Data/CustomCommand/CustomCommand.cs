namespace YEPPDash.Api.Data.CustomCommand;

public sealed record CustomCommand(
    string Name,
    IReadOnlyList<string> Aliases,
    string Message,
    bool Active,
    CommandResponseType ResponseType,
    CommandUserLevel UserLevel
) {
    public IEnumerable<string> Triggers => Aliases.Prepend(Name);
}

public static class CustomCommandLimits
{
    public const int MaxLength = 500;
}