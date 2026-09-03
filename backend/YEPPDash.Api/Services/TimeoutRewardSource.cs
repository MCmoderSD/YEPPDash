using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.EventSub;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class TimeoutRewardSource(IServiceScopeFactory scopeFactory) : RedemptionSource<TimeoutRewardService>(scopeFactory)
{
    public override async Task<IReadOnlyDictionary<int, IReadOnlyList<EventSubRequest>>> RequestsAsync(CancellationToken cancellationToken)
    {
        using var scope = Scopes.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<TimeoutRewardRepository>();

        var configs = await repository.GetAllAsync(cancellationToken);

        return configs.ToDictionary(
            config => config.ChannelId,
            IReadOnlyList<EventSubRequest> (config) => [RedemptionRequest(config.ChannelId, config.RewardId)]);
    }

    // Unlike the giveaway, which reprocesses what it missed, the timeout reward hands every open
    // redemption back: a timeout served minutes late is worse than none at all.
    protected override Task OnCatchUpAsync(TimeoutRewardService service, int channelId, CancellationToken cancellationToken)
    {
        return service.RefundOpenRedemptionsAsync(channelId, cancellationToken);
    }

    protected override Task OnRedemptionAsync(
        TimeoutRewardService service, int channelId, string rewardId, TwitchRedemption redemption, CancellationToken cancellationToken)
    {
        return service.HandleRedemptionAsync(channelId, rewardId, redemption, cancellationToken);
    }
}