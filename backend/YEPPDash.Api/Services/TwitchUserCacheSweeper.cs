namespace YEPPDash.Api.Services;

public sealed class TwitchUserCacheSweeper(TwitchUserCache cache, ILogger<TwitchUserCacheSweeper> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TwitchUserCache.TimeToLive);

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                var dropped = cache.Sweep();
                if (dropped > 0) logger.LogDebug("Dropped {Dropped} expired Twitch profiles from the cache", dropped);
            }
        }
        catch (OperationCanceledException)
        {
            // Shutdown, not a failure.
        }
    }
}