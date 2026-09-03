using YEPPDash.Api.Repositories;
using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Services;

public sealed class QueueWatcher(
    QueueHub hub,
    IServiceScopeFactory scopeFactory,
    ILogger<QueueWatcher> logger
) : BackgroundService {

    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(2);

    private readonly Dictionary<int, DateTime> _published = [];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var ticks = new PeriodicTimer(Interval);

        while (await ticks.WaitForNextTickAsync(stoppingToken))
        {

            var watched = hub.WatchedChannels();

            if (watched.Count is 0)
            {
                _published.Clear();
                continue;
            }

            try
            {
                await PublishChangesAsync(watched, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {

                logger.LogWarning(exception, "Could not check the queues for changes");
            }
        }
    }

    private async Task PublishChangesAsync(IReadOnlyCollection<int> watched, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var queues = scope.ServiceProvider.GetRequiredService<QueueRepository>();

        foreach (var state in await queues.GetManyAsync(watched, cancellationToken))
        {

            if (_published.TryGetValue(state.ChannelId, out var published) && published == state.UpdatedAt) continue;

            _published[state.ChannelId] = state.UpdatedAt;
            hub.Publish(state.ChannelId, QueueEvents.Serialize(state));
        }

        foreach (var channelId in _published.Keys.Where(id => !watched.Contains(id)).ToArray())
        {
            _published.Remove(channelId);
        }
    }
}