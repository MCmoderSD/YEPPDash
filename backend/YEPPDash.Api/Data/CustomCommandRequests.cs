using System.ComponentModel.DataAnnotations;

namespace YEPPDash.Api.Data;

/// <summary>
/// The body of both the create and the update route. Update carries the name too, so a command can
/// be renamed without deleting and re-adding it.
/// </summary>
public sealed record CustomCommandRequest
{
    [Required(AllowEmptyStrings = false)]
    [MaxLength(CustomCommandLimits.MaxLength)]
    public string Name { get; init; } = "";

    public IReadOnlyList<string> Aliases { get; init; } = [];

    [Required(AllowEmptyStrings = false)]
    [MaxLength(CustomCommandLimits.MaxLength)]
    public string Message { get; init; } = "";

    // Defaults to on: a command is added to be used, and a channel that wanted it parked can still
    // switch it off from the table.
    public bool Active { get; init; } = true;

    // Both default to the least surprising answer for a command nobody configured further: a reply
    // to whoever ran it, and no restriction on who that may be.
    public CommandResponseType ResponseType { get; init; } = CommandResponseType.Reply;

    public CommandUserLevel UserLevel { get; init; } = CommandUserLevel.Everyone;
}

/// <summary>
/// Flipping a command on or off is the one edit the table does on its own, so it has a route that
/// does not need the whole command sent back.
/// </summary>
public sealed record CustomCommandActiveRequest
{
    public bool Active { get; init; }
}
