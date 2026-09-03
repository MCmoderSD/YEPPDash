using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.EventSub;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class GiveawaySource(IServiceScopeFactory scopeFactory) : RedemptionSource<GiveawayService>(scopeFactory)
{
    public override async Task<IReadOnlyDictionary<int, IReadOnlyList<EventSubRequest>>> RequestsAsync(CancellationToken cancellationToken)
    {
        using var scope = Scopes.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<GiveawayRepository>();

        var configs = await repository.GetActiveAsync(cancellationToken);

        return configs
            .GroupBy(config => config.ChannelId)
            .ToDictionary(
                group => group.Key,
                IReadOnlyList<EventSubRequest> (group) =>
                [
                    .. group.Select(config => RedemptionRequest(config.ChannelId, config.RewardId)),
                ]);
    }

    protected override Task OnCatchUpAsync(GiveawayService service, int channelId, CancellationToken cancellationToken)
    {
        return service.CatchUpAsync(channelId, cancellationToken);
    }

    protected override Task OnRedemptionAsync(
        GiveawayService service, int channelId, string rewardId, TwitchRedemption redemption, CancellationToken cancellationToken)
    {
        return service.HandleRedemptionAsync(channelId, rewardId, redemption, cancellationToken);
    }
}