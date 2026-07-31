namespace YEPPDash.Api.Data.CustomCommand;

public sealed record CustomCommandResponse(
    string Name,
    IReadOnlyList<string> Aliases,
    string Message,
    bool Active,
    CommandResponseType ResponseType,
    CommandUserLevel UserLevel
) {
    public static CustomCommandResponse From(CustomCommand command)
    {
        return new CustomCommandResponse(
            command.Name,
            command.Aliases,
            command.Message,
            command.Active,
            command.ResponseType,
            command.UserLevel);
    }
}