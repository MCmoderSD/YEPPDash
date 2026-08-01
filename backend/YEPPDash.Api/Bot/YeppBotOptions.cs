namespace YEPPDash.Api.Bot;

public sealed class YeppBotOptions
{
    public Uri? BaseAddress { get; init; }

    public required string ApiKey { get; init; }

    public bool AllowUntrustedCertificate { get; init; }

    public bool Configured => BaseAddress is not null;
}
