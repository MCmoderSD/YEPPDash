using System.Text.Json;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.EventSub;
using YEPPDash.Api.EventSub.Events;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Services;

public sealed class GiveawaySource(IServiceScopeFactory scopeFactory) : IEventSubSource
{
    public async Task<IReadOnlyDictionary<int, IReadOnlyList<EventSubRequest>>> RequestsAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<GiveawayRepository>();

        var configs = await repository.GetActiveAsync(cancellationToken);

        return configs
            .GroupBy(config => config.ChannelId)
            .ToDictionary(
                group => group.Key,
                IReadOnlyList<EventSubRequest> (group) =>
                [
                    .. group.Select(config => new EventSubRequest(
                        EventSubTypes.ChannelPointsRedemptionAdd,
                        EventSubTypes.ChannelPointsRedemptionAddVersion,
                        new Dictionary<string, string>
                        {
                            ["broadcaster_user_id"] = config.ChannelId.ToString(),
                            ["reward_id"] = config.RewardId,
                        })),
                ]);
    }

    public async Task CatchUpAsync(int channelId, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var giveaways = scope.ServiceProvider.GetRequiredService<GiveawayService>();

        await giveaways.CatchUpAsync(channelId, cancellationToken);
    }

    public async Task HandleAsync(int channelId, string type, JsonElement body, CancellationToken cancellationToken)
    {
        if (type is not EventSubTypes.ChannelPointsRedemptionAdd) return;

        var redemption = body.Deserialize<ChannelPointsRedemption>(TwitchJson.Options);
        if (redemption is null) return;

        using var scope = scopeFactory.CreateScope();
        var giveaways = scope.ServiceProvider.GetRequiredService<GiveawayService>();

        await giveaways.HandleRedemptionAsync(channelId, redemption.Reward.Id, ToRedemption(redemption), cancellationToken);
    }

    private static TwitchRedemption ToRedemption(ChannelPointsRedemption redemption)
    {
        return new TwitchRedemption
        {
            Id = redemption.Id,
            UserId = redemption.UserId,
            UserName = redemption.UserName,
            UserInput = redemption.UserInput,
            RedeemedAt = redemption.RedeemedAt,
        };
    }
}