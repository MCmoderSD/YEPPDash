namespace YEPPDash.Api.Bot;

/// <summary>
/// Where the running YEPPBot's API is and how to prove we may call it.
/// </summary>
public sealed class YeppBotOptions
{
    /// <summary>
    /// The bot's API root, ending in a slash — <c>https://host:420/api/</c>. Null when the bot is
    /// not configured, which leaves the dashboard working without one.
    /// </summary>
    public Uri? BaseAddress { get; init; }

    /// <summary>
    /// The key the bot expects: lower-case hex SHA-256 of the Twitch application client secret.
    /// There is no separate credential — both sides derive it from the secret they already share.
    /// </summary>
    public required string ApiKey { get; init; }

    /// <summary>
    /// Whether to accept the bot's TLS certificate without validating it. The bot often runs behind
    /// a self-signed certificate on a private host; opting in is the only way to reach one, and it
    /// is off unless explicitly asked for.
    /// </summary>
    public bool AllowUntrustedCertificate { get; init; }

    public bool Configured => BaseAddress is not null;
}
