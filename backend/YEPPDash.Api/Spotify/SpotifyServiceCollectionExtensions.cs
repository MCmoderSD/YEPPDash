using YEPPDash.Api.Repositories;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Spotify;

public static class SpotifyServiceCollectionExtensions
{
    /// <summary>
    /// Registers the whole Spotify half. Unlike Twitch, the credentials are optional: a deployment
    /// without them still starts, still serves every other feature, and answers the Spotify
    /// endpoints with "not configured". Making them required would mean nobody could run the
    /// dashboard at all without registering a Spotify app first.
    /// </summary>
    public static IServiceCollection AddSpotify(
        this IServiceCollection services, IConfiguration configuration, string dbTarget)
    {
        var options = new SpotifyOptions
        {
            ClientId = configuration[$"Spotify:ClientId{dbTarget}"] ?? configuration["Spotify:ClientId"],
            ClientSecret = configuration[$"Spotify:ClientSecret{dbTarget}"] ?? configuration["Spotify:ClientSecret"],
            RedirectUri = RedirectUri(configuration, dbTarget)
        };

        services.AddSingleton(options);

        // Singletons, both of them, and for one reason: the client cache has to persist a refreshed
        // token from inside a library event that fires with no request in flight. A scoped
        // repository would need a scope conjured up around every refresh; this one holds no state
        // and opens its own connection per call, so there is nothing for a scope to protect.
        services.AddSingleton<SpotifyRepository>();
        services.AddSingleton<SpotifyClientCache>();

        // Singleton for the same reason as the wheel's and the timer's hubs: it holds the open
        // dashboard connections, which outlive any one request.
        services.AddSingleton<SpotifyPlaybackHub>();

        services.AddScoped<ISpotifyPlaybackService, SpotifyPlaybackService>();
        services.AddScoped<SpotifyConnectionService>();
        services.AddScoped<SpotifyQueueProjection>();
        services.AddScoped<SongRequestService>();

        // Spotify cannot tell us a track changed, so an open dashboard would otherwise be showing
        // whatever was playing when it loaded. The worker stops itself when nothing is configured.
        services.AddHostedService<SpotifyPlaybackWatcher>();

        return services;
    }

    private static Uri? RedirectUri(IConfiguration configuration, string dbTarget)
    {
        var value = configuration[$"Spotify:RedirectUri{dbTarget}"] ?? configuration["Spotify:RedirectUri"];

        return Uri.TryCreate(value, UriKind.Absolute, out var uri) ? uri : null;
    }
}
