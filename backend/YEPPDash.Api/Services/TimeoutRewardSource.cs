using System.Text.Json;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.EventSub;
using YEPPDash.Api.EventSub.Events;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Services;

public sealed class TimeoutRewardSource(IServiceScopeFactory scopeFactory) : IEventSubSource
{
    public async Task<IReadOnlyDictionary<int, IReadOnlyList<EventSubRequest>>> RequestsAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<TimeoutRewardRepository>();

        var configs = await repository.GetAllAsync(cancellationToken);

        return configs.ToDictionary(
            config => config.ChannelId,
            IReadOnlyList<EventSubRequest> (config) =>
            [
                new EventSubRequest(
                    EventSubTypes.ChannelPointsRedemptionAdd,
                    EventSubTypes.ChannelPointsRedemptionAddVersion,
                    new Dictionary<string, string>
                    {
                        ["broadcaster_user_id"] = config.ChannelId.ToString(),
                        ["reward_id"] = config.RewardId,
                    }),
            ]);
    }

    public async Task CatchUpAsync(int channelId, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var rewards = scope.ServiceProvider.GetRequiredService<TimeoutRewardService>();

        await rewards.RefundOpenRedemptionsAsync(channelId, cancellationToken);
    }

    public async Task HandleAsync(int channelId, string type, JsonElement body, CancellationToken cancellationToken)
    {
        if (type is not EventSubTypes.ChannelPointsRedemptionAdd) return;

        var redemption = body.Deserialize<ChannelPointsRedemption>(TwitchJson.Options);
        if (redemption is null) return;

        using var scope = scopeFactory.CreateScope();
        var rewards = scope.ServiceProvider.GetRequiredService<TimeoutRewardService>();

        await rewards.HandleRedemptionAsync(channelId, redemption.Reward.Id, ToRedemption(redemption), cancellationToken);
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