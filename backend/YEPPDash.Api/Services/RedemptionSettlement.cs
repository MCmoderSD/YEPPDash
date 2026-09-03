using YEPPDash.Api.Data.Redemption;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Services;

public sealed class RedemptionSettlement(
    RedemptionLogRepository log,
    TwitchApiClient apiClient,
    TwitchAuthService authService,
    ILogger<RedemptionSettlement> logger
) {
    public async Task<string?> ClaimAsync(int channelId, string rewardId, TwitchRedemption redemption, CancellationToken cancellationToken)
    {
        var broadcasterId = channelId.ToString();

        var token = await authService.GetValidTokenAsync(broadcasterId, cancellationToken);
        if (token is null)
        {
            logger.LogWarning(
                "Channel {ChannelId} has no usable Twitch token, leaving redemption {RedemptionId} open",
                channelId, redemption.Id);

            return null;
        }

        var claimed = await log.TryRecordAsync(
            new RedemptionRecord(
                redemption.Id, channelId, rewardId, redemption.UserId, redemption.UserInput, redemption.RedeemedAt.UtcDateTime),
            cancellationToken);

        if (claimed) return token.AccessToken;

        logger.LogDebug("Redemption {RedemptionId} in channel {ChannelId} was already handled", redemption.Id, channelId);
        return null;
    }

    public async Task<bool> SettleAsync(int channelId, string rewardId, TwitchRedemption redemption, string status, string accessToken, CancellationToken cancellationToken)
    {
        try
        {
            await apiClient.UpdateRedemptionStatusAsync(
                channelId.ToString(), rewardId, redemption.Id, status, accessToken, cancellationToken);

            return true;
        }
        catch (TwitchOAuthException exception)
        {
            logger.LogWarning(
                "Could not mark redemption {RedemptionId} as {Status} in channel {ChannelId} ({StatusCode})",
                redemption.Id, status, channelId, exception.StatusCode);

            return false;
        }
    }

    public async Task RefundAsync(int channelId, string rewardId, TwitchRedemption redemption, string reason, string accessToken, CancellationToken cancellationToken)
    {
        var refunded = await SettleAsync(channelId, rewardId, redemption, RedemptionStatus.Canceled, accessToken, cancellationToken);
        if (!refunded) return;

        await log.MarkAsync(redemption.Id, RedemptionStatus.Canceled, reason, cancellationToken);

        logger.LogInformation(
            "Refunded redemption {RedemptionId} in channel {ChannelId} by {RedeemerId}: {Reason}",
            redemption.Id, channelId, redemption.UserId, reason);
    }

    public async Task FulfilAsync(int channelId, string rewardId, TwitchRedemption redemption, string reason, string accessToken, CancellationToken cancellationToken)
    {
        await SettleAsync(channelId, rewardId, redemption, RedemptionStatus.Fulfilled, accessToken, cancellationToken);
        await log.MarkAsync(redemption.Id, RedemptionStatus.Fulfilled, reason, cancellationToken);
    }
}