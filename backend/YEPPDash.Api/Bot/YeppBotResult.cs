namespace YEPPDash.Api.Bot;

public sealed record YeppBotResult(bool Success, int Status, string Message)
{
    public const int Unreachable = 0;

    public static YeppBotResult NotConfigured { get; } =
        new(false, Unreachable, "No YEPPBot instance is configured for this dashboard.");

    public static YeppBotResult Failed(string message)
    {
        return new YeppBotResult(false, Unreachable, message);
    }
}

internal sealed record YeppBotPayload(bool Success, int Status, string? Message);
