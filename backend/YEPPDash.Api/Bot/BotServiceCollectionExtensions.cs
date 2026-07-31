using System.Security.Cryptography;
using System.Text;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Bot;

public static class BotServiceCollectionExtensions
{
    // The bot reloads its commands asynchronously and answers as soon as it has started, so these
    // calls are quick. A short ceiling keeps a bot that has stopped answering from holding up a
    // dashboard request that has already done its own work.
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    public static IServiceCollection AddYeppBot(
        this IServiceCollection services, IConfiguration configuration, string dbTarget)
    {
        // Optional on purpose: the dashboard is useful without a reachable bot, and everything it
        // does to the database still works. Only the "tell the bot" step goes quiet.
        var baseUrl = configuration[$"YeppBot:BaseUrl{dbTarget}"] ?? configuration["YeppBot:BaseUrl"];

        var options = new YeppBotOptions
        {
            BaseAddress = ToBaseAddress(baseUrl),
            ApiKey = ApiKeyFor(configuration.GetRequiredValue($"Twitch:ClientSecret{dbTarget}")),
            AllowUntrustedCertificate =
                configuration.GetValue($"YeppBot:AllowUntrustedCertificate{dbTarget}", false)
                || configuration.GetValue("YeppBot:AllowUntrustedCertificate", false),
        };

        services.AddSingleton(options);

        var builder = services.AddHttpClient<YeppBotClient>(client =>
        {
            if (options.BaseAddress is not null) client.BaseAddress = options.BaseAddress;
            client.Timeout = Timeout;
        });

        if (options.AllowUntrustedCertificate)
        {
            builder.ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
            {
                // Scoped to this one client, so nothing else in the app loses certificate checking.
                ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator,
            });
        }

        return services;
    }

    /// <summary>
    /// The key the bot expects: lower-case hex SHA-256 of the client secret both sides already hold.
    /// </summary>
    private static string ApiKeyFor(string clientSecret)
    {
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(clientSecret)));
    }

    /// <summary>
    /// HttpClient only treats a base address as a directory when it ends in a slash — without one
    /// the last segment is replaced rather than appended to, and every call would miss <c>/api</c>.
    /// </summary>
    private static Uri? ToBaseAddress(string? baseUrl)
    {
        if (string.IsNullOrWhiteSpace(baseUrl)) return null;

        var trimmed = baseUrl.Trim();
        return new Uri(trimmed.EndsWith('/') ? trimmed : trimmed + '/', UriKind.Absolute);
    }
}
