using YEPPDash.Api.Services;

namespace YEPPDash.Api.EventSub;

public sealed class EventSubHost(
    IEnumerable<IEventSubSource> sources,
    EventSubSocket socket,
    IServiceScopeFactory scopeFactory,
    ILogger<EventSubHost> logger
) : BackgroundService {

    private static readonly TimeSpan ReconcileInterval = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan ReplayWindow = TimeSpan.FromMinutes(10);

    private const int SeenLimit = 512;

    private readonly SemaphoreSlim _wake = new(0, 1);
    private readonly Dictionary<int, Listener> _listeners = [];
    private readonly HashSet<string> _seen = [];
    private readonly Queue<string> _seenOrder = new();
    private readonly HashSet<int> _unfinished = [];

    public void Resync()
    {
        try
        {
            _wake.Release();
        }
        catch (SemaphoreFullException)
        {
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ReconcileAsync(stoppingToken);
                await RetryAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Could not reconcile the EventSub listeners");
            }

            try
            {
                await _wake.WaitAsync(ReconcileInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        foreach (var listener in _listeners.Values)
        {
            await listener.Stop.CancelAsync();
        }

        await Task.WhenAll(_listeners.Values.Select(listener => listener.Run));

        foreach (var listener in _listeners.Values)
        {
            listener.Stop.Dispose();
        }

        _listeners.Clear();
    }

    private async Task ReconcileAsync(CancellationToken stoppingToken)
    {
        var wanted = await PlanAsync(stoppingToken);

        foreach (var (channelId, listener) in _listeners.ToArray())
        {
            var keep = wanted.TryGetValue(channelId, out var plan)
                && string.Equals(SignatureOf(plan), listener.Signature, StringComparison.Ordinal)
                && !listener.Run.IsCompleted;

            if (keep) continue;

            await listener.Stop.CancelAsync();
            await listener.Run;

            listener.Stop.Dispose();
            _listeners.Remove(channelId);
        }

        foreach (var (channelId, plan) in wanted)
        {
            if (_listeners.ContainsKey(channelId)) continue;

            var stop = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            _listeners[channelId] = new Listener(SignatureOf(plan), plan, stop, RunAsync(channelId, plan, stop.Token));
        }
    }

    private async Task<Dictionary<int, List<Planned>>> PlanAsync(CancellationToken cancellationToken)
    {
        var plans = new Dictionary<int, List<Planned>>();

        foreach (var source in sources)
        {
            var requests = await source.RequestsAsync(cancellationToken);

            foreach (var (channelId, wanted) in requests)
            {
                if (wanted.Count is 0) continue;

                if (!plans.TryGetValue(channelId, out var plan)) plans[channelId] = plan = [];
                plan.AddRange(wanted.Select(request => new Planned(source, request)));
            }
        }

        return plans;
    }

    private async Task RunAsync(int channelId, IReadOnlyList<Planned> plan, CancellationToken cancellationToken)
    {
        var failures = 0;

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var accessToken = await AccessTokenAsync(channelId, cancellationToken);

                await socket.RunAsync(
                    channelId.ToString(),
                    accessToken,
                    [.. plan.Select(planned => planned.Request)],
                    token => ReadyAsync(channelId, plan, token),
                    (message, token) => NotifyAsync(channelId, plan, message, token),
                    cancellationToken);

                failures = 0;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                failures++;
                logger.LogWarning(exception, "The EventSub socket for the channel {ChannelId} dropped", channelId);
            }

            try
            {
                await Task.Delay(Backoff(failures), cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task ReadyAsync(int channelId, IReadOnlyList<Planned> plan, CancellationToken cancellationToken)
    {
        foreach (var source in plan.Select(planned => planned.Source).Distinct())
        {
            try
            {
                await source.CatchUpAsync(channelId, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Could not catch up on EventSub for the channel {ChannelId}", channelId);
            }
        }
    }

    private async Task NotifyAsync(int channelId, IReadOnlyList<Planned> plan, EventSubMessage message, CancellationToken cancellationToken)
    {
        var type = message.Metadata.SubscriptionType;
        if (string.IsNullOrEmpty(type)) return;
        if (message.Payload.Event is not { } body) return;

        if (DateTimeOffset.UtcNow - message.Metadata.MessageTimestamp > ReplayWindow) return;
        if (!FirstSighting(message.Metadata.MessageId)) return;

        var listening = plan
            .Where(planned => string.Equals(planned.Request.Type, type, StringComparison.Ordinal))
            .Select(planned => planned.Source)
            .Distinct();

        foreach (var source in listening)
        {
            try
            {
                await source.HandleAsync(channelId, type, body, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                lock (_unfinished) _unfinished.Add(channelId);

                logger.LogWarning(exception, "Handling {Type} for channel {ChannelId} failed", type, channelId);
            }
        }
    }

    private async Task RetryAsync(CancellationToken cancellationToken)
    {
        int[] channels;
        lock (_unfinished)
        {
            channels = [.. _unfinished];
            _unfinished.Clear();
        }

        foreach (var channelId in channels)
        {
            if (!_listeners.TryGetValue(channelId, out var listener)) continue;

            await ReadyAsync(channelId, listener.Plan, cancellationToken);
        }
    }

    private async Task<string> AccessTokenAsync(int channelId, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var auth = scope.ServiceProvider.GetRequiredService<TwitchAuthService>();

        var token = await auth.GetValidTokenAsync(channelId.ToString(), cancellationToken)
            ?? throw new InvalidOperationException($"Channel {channelId} has no usable Twitch token.");

        return token.AccessToken;
    }

    private bool FirstSighting(string messageId)
    {
        lock (_seen)
        {
            if (!_seen.Add(messageId)) return false;

            _seenOrder.Enqueue(messageId);
            if (_seenOrder.Count > SeenLimit) _seen.Remove(_seenOrder.Dequeue());

            return true;
        }
    }

    private static string SignatureOf(IReadOnlyList<Planned> plan)
    {
        return string.Join('|', plan.Select(planned => planned.Request.Signature).OrderBy(signature => signature, StringComparer.Ordinal));
    }

    private static TimeSpan Backoff(int failures)
    {
        return TimeSpan.FromSeconds(Math.Min(60, Math.Pow(2, Math.Min(failures, 6))));
    }

    private sealed record Planned(IEventSubSource Source, EventSubRequest Request);

    private sealed record Listener(string Signature, IReadOnlyList<Planned> Plan, CancellationTokenSource Stop, Task Run);
}