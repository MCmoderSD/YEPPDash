namespace YEPPDash.Api.Services.Streaming;

public abstract class ChangeWatcher<TState>(
    StreamHub hub,
    IServiceScopeFactory scopeFactory,
    ILogger logger
) : BackgroundService {

    private readonly Dictionary<int, DateTime> _published = [];

    protected abstract TimeSpan Interval { get; }

    protected abstract string Subject { get; }

    protected abstract Task<IReadOnlyList<TState>> FetchAsync(IServiceProvider services, IReadOnlyCollection<int> watched, CancellationToken cancellationToken);

    protected abstract int ChannelOf(TState state);

    protected abstract DateTime UpdatedAtOf(TState state);

    protected abstract string Serialize(TState state, DateTime serverNow);

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
                logger.LogWarning(exception, "Could not check {Subject} for changes", Subject);
            }
        }
    }

    private async Task PublishChangesAsync(IReadOnlyCollection<int> watched, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();

        var states = await FetchAsync(scope.ServiceProvider, watched, cancellationToken);

        var serverNow = DateTime.UtcNow;

        foreach (var state in states)
        {
            var channelId = ChannelOf(state);
            var updatedAt = UpdatedAtOf(state);

            if (_published.TryGetValue(channelId, out var published) && published == updatedAt) continue;

            _published[channelId] = updatedAt;
            hub.Publish(channelId, Serialize(state, serverNow));
        }

        foreach (var channelId in _published.Keys.Where(id => !watched.Contains(id)).ToArray())
        {
            _published.Remove(channelId);
        }
    }
}