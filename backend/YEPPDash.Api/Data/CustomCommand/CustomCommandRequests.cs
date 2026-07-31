using System.ComponentModel.DataAnnotations;

namespace YEPPDash.Api.Data.CustomCommand;

public sealed record CustomCommandRequest
{
    [Required(AllowEmptyStrings = false)]
    [MaxLength(CustomCommandLimits.MaxLength)]
    public string Name { get; init; } = "";

    public IReadOnlyList<string> Aliases { get; init; } = [];

    [Required(AllowEmptyStrings = false)]
    [MaxLength(CustomCommandLimits.MaxLength)]
    public string Message { get; init; } = "";

    public bool Active { get; init; } = true;

    public CommandResponseType ResponseType { get; init; } = CommandResponseType.Reply;

    public CommandUserLevel UserLevel { get; init; } = CommandUserLevel.Everyone;
}

public sealed record CustomCommandActiveRequest
{
    public bool Active { get; init; }
}