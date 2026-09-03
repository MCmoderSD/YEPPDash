using YEPPDash.Api.Data.SubathonTimer;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Services;

public sealed class SubathonTimerWatcher(
    SubathonTimerHub hub,
    IServiceScopeFactory scopeFactory,
    ILogger<SubathonTimerWatcher> logger
) : ChangeWatcher<SubathonTimerState>(hub, scopeFactory, logger) {

    protected override TimeSpan Interval { get; } = TimeSpan.FromSeconds(1);

    protected override string Subject { get; } = "the subathon timers";

    protected override Task<IReadOnlyList<SubathonTimerState>> FetchAsync(IServiceProvider services, IReadOnlyCollection<int> watched, CancellationToken cancellationToken)
    {
        return services.GetRequiredService<SubathonTimerRepository>().GetManyAsync(watched, cancellationToken);
    }

    protected override int ChannelOf(SubathonTimerState state)
    {
        return state.ChannelId;
    }

    protected override DateTime UpdatedAtOf(SubathonTimerState state)
    {
        return state.UpdatedAt;
    }

    protected override string Serialize(SubathonTimerState state, DateTime serverNow)
    {
        return SubathonTimerEvents.Serialize(state, serverNow);
    }
}