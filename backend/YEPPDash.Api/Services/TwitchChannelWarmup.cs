using System.Collections.Concurrent;
using System.Threading.Channels;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class TwitchChannelWarmup
{
    private readonly Channel<string> _queue = Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true });

    private readonly ConcurrentDictionary<string, byte> _pending = new(StringComparer.Ordinal);

    public ChannelReader<string> Reader => _queue.Reader;

    public void Queue(string broadcasterId)
    {
        if (!_pending.TryAdd(broadcasterId, 0)) return;
        if (!_queue.Writer.TryWrite(broadcasterId)) Release(broadcasterId);
    }

    public void Release(string broadcasterId)
    {
        _pending.TryRemove(broadcasterId, out _);
    }
}

public sealed class TwitchChannelWarmupWorker(
    TwitchChannelWarmup warmup,
    IServiceScopeFactory scopeFactory,
    ILogger<TwitchChannelWarmupWorker> logger
) : BackgroundService {

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var pendingSeed = await SeedAsync(stoppingToken);
        var seedTotal = pendingSeed?.Count ?? 0;

        if (pendingSeed is { Count: 0 })
        {
            logger.LogInformation("All caches loaded — no stored channels to warm up");
        }

        await foreach (var broadcasterId in warmup.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await WarmAsync(broadcasterId, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Warming the channel lists of {BroadcasterId} failed", broadcasterId);
            }
            finally
            {
                warmup.Release(broadcasterId);
            }

            if (pendingSeed?.Remove(broadcasterId) == true && pendingSeed.Count == 0)
            {
                logger.LogInformation("All caches loaded — startup warm-up complete for {Count} channels", seedTotal);
            }
        }
    }

    private async Task<HashSet<string>?> SeedAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var tokens = scope.ServiceProvider.GetRequiredService<DatabaseTwitchTokenStore>();

            var userIds = await tokens.GetUserIdsAsync(cancellationToken);
            foreach (var userId in userIds) warmup.Queue(userId);

            logger.LogInformation("Queued {Count} stored channels for a cache warm-up", userIds.Count);
            return [.. userIds];
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return null;
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Could not queue the stored channels for a cache warm-up");
            return null;
        }
    }

    private async Task WarmAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var channels = scope.ServiceProvider.GetRequiredService<TwitchChannelService>();

        var moderators = await channels.GetModeratorsAsync(broadcasterId, cancellationToken);
        var vips = await channels.GetVipsAsync(broadcasterId, cancellationToken);
        var followers = await channels.GetFollowersAsync(broadcasterId, cancellationToken);
        var bans = await channels.GetBanCountsAsync(broadcasterId, cancellationToken);

        logger.LogInformation(
            "All caches loaded for channel {BroadcasterId}: {Moderators} moderators, {Vips} VIPs, {Followers} followers, {Timeouts} timeouts, {Bans} bans",
            broadcasterId, moderators.Count, vips.Count, followers.Count, bans.Timeouts, bans.Bans);
    }
}