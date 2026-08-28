namespace YEPPDash.Api.Services;

// Walks the profile cache once per lifetime and drops what has aged out. The cache expires an entry
// when it is read, which is enough to keep it honest but not enough to keep it small: nobody reads
// the ten thousand followers of a channel that was opened once and left, so without this they would
// sit there until the process restarts.
//
// One pass per TTL rather than anything cleverer: an entry therefore lives somewhere between one and
// two lifetimes before it is collected, which costs a little memory and saves waking the server up
// on a shorter timer to save it.
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
