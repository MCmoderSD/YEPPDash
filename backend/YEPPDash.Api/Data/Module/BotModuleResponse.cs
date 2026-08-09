namespace YEPPDash.Api.Data.Module;

public sealed record BotModuleResponse(
    string Id,
    string Name,
    string Description,
    IReadOnlyList<string> Aliases,
    bool Enabled
) {
    /// <param name="enabled">
    /// The stored state is the opposite: a channel's row in <c>Blacklist</c> is what turns a module
    /// off. Flipping it here keeps the browser reading "enabled" rather than the bot's "blocked".
    /// </param>
    public static BotModuleResponse From(BotModule module, bool enabled)
    {
        return new BotModuleResponse(module.Id, module.Name, module.Description, module.Aliases, enabled);
    }
}
