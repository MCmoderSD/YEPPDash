using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class SubathonTimerWatcher(
    SubathonTimerHub hub,
    IServiceScopeFactory scopeFactory,
    ILogger<SubathonTimerWatcher> logger
) : BackgroundService {

    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(1);

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

                logger.LogWarning(exception, "Could not check the subathon timers for changes");
            }
        }
    }

    private async Task PublishChangesAsync(IReadOnlyCollection<int> watched, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var timers = scope.ServiceProvider.GetRequiredService<SubathonTimerRepository>();

        var states = await timers.GetManyAsync(watched, cancellationToken);
        var serverNow = DateTime.UtcNow;

        foreach (var state in states)
        {

            if (_published.TryGetValue(state.ChannelId, out var published) && published == state.UpdatedAt) continue;

            _published[state.ChannelId] = state.UpdatedAt;
            hub.Publish(state.ChannelId, SubathonTimerEvents.Serialize(state, serverNow));
        }

        foreach (var channelId in _published.Keys.Where(id => !watched.Contains(id)).ToArray())
        {
            _published.Remove(channelId);
        }
    }
}