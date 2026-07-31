namespace YEPPDash.Api.Bot;

/// <summary>
/// What the bot answered, or why it could not be asked. <paramref name="Status"/> is the bot's own
/// HTTP status where there was one, and <see cref="Unreachable"/> where the call never landed.
/// </summary>
public sealed record YeppBotResult(bool Success, int Status, string Message)
{
    /// <summary>Stands in for a status the bot never got to send.</summary>
    public const int Unreachable = 0;

    public static YeppBotResult NotConfigured { get; } =
        new(false, Unreachable, "No YEPPBot instance is configured for this dashboard.");

    public static YeppBotResult Failed(string message)
    {
        return new YeppBotResult(false, Unreachable, message);
    }
}

/// <summary>The body every endpoint answers with.</summary>
internal sealed record YeppBotPayload(bool Success, int Status, string? Message);
