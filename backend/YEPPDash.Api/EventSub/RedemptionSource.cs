using System.Text.Json;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.EventSub.Events;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.EventSub;

public abstract class RedemptionSource<TService>(IServiceScopeFactory scopeFactory) : IEventSubSource where TService : notnull
{
    protected IServiceScopeFactory Scopes { get; } = scopeFactory;

    public abstract Task<IReadOnlyDictionary<int, IReadOnlyList<EventSubRequest>>> RequestsAsync(CancellationToken cancellationToken);
    
    protected abstract Task OnCatchUpAsync(TService service, int channelId, CancellationToken cancellationToken);
    protected abstract Task OnRedemptionAsync(TService service, int channelId, string rewardId, TwitchRedemption redemption, CancellationToken cancellationToken);

    public async Task CatchUpAsync(int channelId, CancellationToken cancellationToken)
    {
        using var scope = Scopes.CreateScope();

        await OnCatchUpAsync(scope.ServiceProvider.GetRequiredService<TService>(), channelId, cancellationToken);
    }

    public async Task HandleAsync(int channelId, string type, JsonElement body, CancellationToken cancellationToken)
    {
        if (type is not EventSubTypes.ChannelPointsRedemptionAdd) return;

        var redemption = body.Deserialize<ChannelPointsRedemption>(TwitchJson.Options);
        if (redemption is null) return;

        using var scope = Scopes.CreateScope();

        await OnRedemptionAsync(
            scope.ServiceProvider.GetRequiredService<TService>(),
            channelId,
            redemption.Reward.Id,
            ToRedemption(redemption),
            cancellationToken);
    }

    protected static EventSubRequest RedemptionRequest(int channelId, string rewardId)
    {
        return new EventSubRequest(
            EventSubTypes.ChannelPointsRedemptionAdd,
            EventSubTypes.ChannelPointsRedemptionAddVersion,
            new Dictionary<string, string>
            {
                ["broadcaster_user_id"] = channelId.ToString(),
                ["reward_id"] = rewardId,
            });
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