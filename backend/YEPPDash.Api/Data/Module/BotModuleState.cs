namespace YEPPDash.Api.Data.Module;

/// <param name="Enabled">
/// Whether the channel has this module on — the inverse of a <c>Blacklist</c> row, since the table
/// only records what is switched off.
/// </param>
public sealed record BotModuleState(BotModule Module, bool Enabled);
