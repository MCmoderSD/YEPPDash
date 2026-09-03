using YEPPDash.Api.Data.Queue;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Services;

public sealed class QueueWatcher(
    QueueHub hub,
    IServiceScopeFactory scopeFactory,
    ILogger<QueueWatcher> logger
) : ChangeWatcher<QueueState>(hub, scopeFactory, logger) {

    protected override TimeSpan Interval { get; } = TimeSpan.FromSeconds(2);

    protected override string Subject { get; } = "the queues";

    protected override Task<IReadOnlyList<QueueState>> FetchAsync(IServiceProvider services, IReadOnlyCollection<int> watched, CancellationToken cancellationToken)
    {
        return services.GetRequiredService<QueueRepository>().GetManyAsync(watched, cancellationToken);
    }

    protected override int ChannelOf(QueueState state)
    {
        return state.ChannelId;
    }

    protected override DateTime UpdatedAtOf(QueueState state)
    {
        return state.UpdatedAt;
    }

    protected override string Serialize(QueueState state, DateTime serverNow)
    {
        return QueueEvents.Serialize(state);
    }
}