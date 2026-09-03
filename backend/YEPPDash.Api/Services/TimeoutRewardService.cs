using YEPPDash.Api.Data.Redemption;
using YEPPDash.Api.Data.TimeoutReward;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.EventSub;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Services;

public sealed class TimeoutRewardService(
    TimeoutRewardRepository repository,
    RedemptionLogRepository log,
    RedemptionSettlement redemptions,
    TwitchChannelService channels,
    TwitchApiClient apiClient,
    TwitchAuthService authService,
    EventSubHost eventSub,
    ILogger<TimeoutRewardService> logger
) {
    private static readonly TimeSpan RestoreGrace = TimeSpan.Zero;
    private static readonly TimeSpan RestoreRetryDelay = TimeSpan.FromSeconds(5);

    private const int RestoreAttempts = 3;

    private static readonly TimeSpan InFlight = TimeSpan.FromMinutes(2);

    private const string DefaultPrompt = "Type the name of the user to time out — @name works too.";

    public async Task<TimeoutRewardSettings?> GetAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var config = await repository.GetAsync(int.Parse(broadcasterId), cancellationToken);
        if (config is null) return null;

        try
        {
            var rewards = await channels.GetCustomRewardsAsync(broadcasterId, [config.RewardId], cancellationToken);
            if (rewards.Count > 0) return new TimeoutRewardSettings(rewards[0], config.DurationSeconds, [.. config.Protected]);
        }
        catch (TwitchOAuthException exception) when (exception.IsNotFound())
        {
        }

        await repository.DeleteAsync(config.ChannelId, cancellationToken);
        return null;
    }

    public async Task<TimeoutRewardSettings> SaveAsync(string broadcasterId, TimeoutRewardUpdate update, CancellationToken cancellationToken)
    {
        var channelId = int.Parse(broadcasterId);
        var existing = await repository.GetAsync(channelId, cancellationToken);

        CustomReward reward;

        if (existing is null)
        {
            reward = await channels.CreateCustomRewardAsync(broadcasterId, CustomRewardRequests.Create(Of(update)), cancellationToken);
        }
        else
        {
            try
            {
                reward = await channels.UpdateCustomRewardAsync(broadcasterId, existing.RewardId, CustomRewardRequests.Update(Of(update)), cancellationToken);
            }
            catch (TwitchOAuthException exception) when (exception.IsNotFound())
            {
                reward = await channels.CreateCustomRewardAsync(broadcasterId, CustomRewardRequests.Create(Of(update)), cancellationToken);
            }
        }

        var config = new TimeoutRewardConfig(
            channelId,
            reward.Id,
            reward.Title,
            reward.Prompt,
            reward.Cost,
            update.DurationSeconds,
            reward.GlobalCooldownSetting.IsEnabled ? reward.GlobalCooldownSetting.GlobalCooldownSeconds : null,
            reward.MaxPerStreamSetting.IsEnabled ? reward.MaxPerStreamSetting.MaxPerStream : null,
            reward.MaxPerUserPerStreamSetting.IsEnabled ? reward.MaxPerUserPerStreamSetting.MaxPerUserPerStream : null,
            update.Protected.ToHashSet());

        await repository.SetAsync(config, cancellationToken);

        eventSub.Resync();

        logger.LogInformation(
            "Timeout reward saved for channel {BroadcasterId}: reward {RewardId}, {Duration}s, {Protected} protected roles",
            broadcasterId, reward.Id, config.DurationSeconds, config.Protected.Count);

        return new TimeoutRewardSettings(reward, config.DurationSeconds, [.. config.Protected]);
    }

    public async Task DeleteAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var channelId = int.Parse(broadcasterId);
        var config = await repository.GetAsync(channelId, cancellationToken);
        if (config is null) return;

        await channels.DeleteIfPresentAsync(broadcasterId, config.RewardId, cancellationToken);

        await repository.DeleteAsync(channelId, cancellationToken);

        eventSub.Resync();

        logger.LogInformation("Timeout reward removed for channel {BroadcasterId}", broadcasterId);
    }

    public async Task HandleRedemptionAsync(int channelId, string rewardId, TwitchRedemption redemption, CancellationToken cancellationToken)
    {
        var config = await repository.GetAsync(channelId, cancellationToken);
        if (config is null || !string.Equals(config.RewardId, rewardId, StringComparison.Ordinal)) return;

        var broadcasterId = channelId.ToString();

        var accessToken = await redemptions.ClaimAsync(channelId, rewardId, redemption, cancellationToken);
        if (accessToken is null) return;

        try
        {
            await HandleRedemptionAsync(config, broadcasterId, redemption, accessToken, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Handling redemption {RedemptionId} in channel {ChannelId} failed", redemption.Id, channelId);

            await RefundAsync(config, broadcasterId, redemption, "handling it failed", accessToken, cancellationToken);
        }
    }

    public async Task RefundOpenRedemptionsAsync(int channelId, CancellationToken cancellationToken)
    {
        var config = await repository.GetAsync(channelId, cancellationToken);
        if (config is null) return;

        var broadcasterId = channelId.ToString();

        var token = await authService.GetValidTokenAsync(broadcasterId, cancellationToken);
        if (token is null) return;

        IReadOnlyList<TwitchRedemption> open;

        try
        {
            open = await apiClient.GetRedemptionsAsync(broadcasterId, config.RewardId, RedemptionStatus.Unfulfilled, token.AccessToken, cancellationToken);
        }
        catch (TwitchOAuthException exception) when (exception.IsNotFound())
        {
            await repository.DeleteAsync(config.ChannelId, cancellationToken);

            logger.LogWarning("Timeout reward {RewardId} vanished from Twitch, dropped the config for channel {ChannelId}", config.RewardId, config.ChannelId);
            return;
        }

        foreach (var redemption in open)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var inFlight = DateTimeOffset.UtcNow - redemption.RedeemedAt < InFlight;
            if (inFlight && await log.HasAsync(redemption.Id, cancellationToken)) continue;

            if (!await redemptions.SettleAsync(channelId, config.RewardId, redemption, RedemptionStatus.Canceled, token.AccessToken, cancellationToken)) continue;

            const string reason = "redeemed while nothing was listening";

            var recorded = await log.TryRecordAsync(
                new RedemptionRecord(
                    redemption.Id, channelId, config.RewardId, redemption.UserId, redemption.UserInput,
                    redemption.RedeemedAt.UtcDateTime, RedemptionStatus.Canceled, reason),
                cancellationToken);

            if (!recorded) await log.MarkAsync(redemption.Id, RedemptionStatus.Canceled, reason, cancellationToken);

            logger.LogInformation(
                "Refunded redemption {RedemptionId} in channel {ChannelId}: {Reason}",
                redemption.Id, channelId, reason);
        }
    }

    public async Task RestoreRolesAsync(CancellationToken cancellationToken)
    {
        var due = await repository.GetDueRestoresAsync(DateTime.UtcNow, cancellationToken);

        foreach (var restore in due)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var broadcasterId = restore.ChannelId.ToString();

            try
            {
                if (restore.Role is RestorableRole.Moderator) await channels.AddModeratorAsync(broadcasterId, restore.UserId, cancellationToken);
                else await channels.AddVipAsync(broadcasterId, restore.UserId, cancellationToken);

                await repository.DeleteRestoreAsync(restore, cancellationToken);

                logger.LogInformation(
                    "Restored {Role} to {UserId} in channel {ChannelId} after a timeout reward",
                    restore.Role, restore.UserId, restore.ChannelId);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                await RetryOrGiveUpAsync(restore, exception, cancellationToken);
            }
        }
    }

    private async Task RetryOrGiveUpAsync(RoleRestore restore, Exception exception, CancellationToken cancellationToken)
    {
        var attempts = restore.Attempts + 1;

        if (attempts >= RestoreAttempts)
        {
            await repository.DeleteRestoreAsync(restore, cancellationToken);

            logger.LogWarning(
                exception,
                "Gave up restoring {Role} to {UserId} in channel {ChannelId} after {Attempts} attempts",
                restore.Role, restore.UserId, restore.ChannelId, attempts);

            return;
        }

        var next = restore with { Attempts = attempts, RestoreAt = DateTime.UtcNow + RestoreRetryDelay };
        await repository.ScheduleRestoreAsync(next, cancellationToken);

        logger.LogWarning(
            "Restoring {Role} to {UserId} in channel {ChannelId} failed ({Message}), attempt {Attempts} of {Total} follows in {Delay}s",
            restore.Role, restore.UserId, restore.ChannelId, exception.Message, attempts + 1, RestoreAttempts, RestoreRetryDelay.TotalSeconds);
    }

    private async Task HandleRedemptionAsync(TimeoutRewardConfig config, string broadcasterId, TwitchRedemption redemption, string accessToken, CancellationToken cancellationToken)
    {
        var login = ParseTarget(redemption.UserInput);

        if (login is null)
        {
            await RefundAsync(config, broadcasterId, redemption, "the input is not a username", accessToken, cancellationToken);
            return;
        }

        var targets = await channels.GetUserProfilesAsync(broadcasterId, [], [login], cancellationToken);
        var target = targets.Count > 0 ? targets[0] : null;

        if (target is null)
        {
            await RefundAsync(config, broadcasterId, redemption, $"no Twitch user is called '{login}'", accessToken, cancellationToken);
            return;
        }

        if (target.Roles?.Broadcaster == true)
        {
            await RefundAsync(config, broadcasterId, redemption, "the target is the broadcaster", accessToken, cancellationToken);
            return;
        }

        if (await IsProtectedAsync(config, broadcasterId, target, accessToken, cancellationToken))
        {
            await RefundAsync(config, broadcasterId, redemption, $"'{login}' holds a protected role", accessToken, cancellationToken);
            return;
        }

        var hadModerator = target.Roles?.Moderator == true;

        try
        {
            await channels.BanUserAsync(
                broadcasterId, target.Id, config.DurationSeconds,
                $"Timeout reward redeemed by {redemption.UserName}", cancellationToken);
        }
        catch (TwitchOAuthException exception) when ((int)exception.StatusCode is >= 400 and < 500 and not 429)
        {
            var alreadyBanned = exception.ResponseBody?.Contains("already banned", StringComparison.OrdinalIgnoreCase) == true;

            if (alreadyBanned)
            {
                await redemptions.FulfilAsync(
                    config.ChannelId, config.RewardId, redemption, $"{target.Id} was already banned", accessToken, cancellationToken);

                logger.LogInformation(
                    "Redemption {RedemptionId} in channel {ChannelId} counted as spent: {TargetId} was already banned",
                    redemption.Id, config.ChannelId, target.Id);
            }
            else
            {
                await RefundAsync(config, broadcasterId, redemption, $"Twitch refused the ban ({(int)exception.StatusCode})", accessToken, cancellationToken);
            }

            return;
        }

        var restoreAt = DateTime.UtcNow + TimeSpan.FromSeconds(config.DurationSeconds) + RestoreGrace;

        if (hadModerator) await repository.ScheduleRestoreAsync(new RoleRestore(config.ChannelId, target.Id, RestorableRole.Moderator, restoreAt), cancellationToken);

        await redemptions.FulfilAsync(
            config.ChannelId, config.RewardId, redemption,
            $"timed out {target.Id} for {config.DurationSeconds}s", accessToken, cancellationToken);

        logger.LogInformation(
            "Timed out {TargetId} for {Duration}s in channel {ChannelId}, redeemed by {RedeemerId}",
            target.Id, config.DurationSeconds, config.ChannelId, redemption.UserId);
    }

    private async Task<bool> IsProtectedAsync(TimeoutRewardConfig config, string broadcasterId, TwitchUser target, string accessToken, CancellationToken cancellationToken)
    {
        var roles = target.Roles;

        if (config.Protected.Contains(ProtectedRole.Moderator) && roles?.Moderator == true) return true;
        if (config.Protected.Contains(ProtectedRole.Vip) && roles?.Vip == true) return true;
        if (config.Protected.Contains(ProtectedRole.Editor) && roles?.Editor == true) return true;

        if (config.Protected.Contains(ProtectedRole.Follower))
        {
            var follower = await channels.GetFollowerAsync(broadcasterId, target.Id, cancellationToken);
            if (follower is not null) return true;
        }

        var subTiers = config.Protected.Contains(ProtectedRole.Subscriber)
            || config.Protected.Contains(ProtectedRole.Tier2Subscriber)
            || config.Protected.Contains(ProtectedRole.Tier3Subscriber);

        if (!subTiers) return false;

        var subscription = await apiClient.GetSubscriptionAsync(broadcasterId, target.Id, accessToken, cancellationToken);
        if (subscription is null) return false;

        if (config.Protected.Contains(ProtectedRole.Subscriber)) return true;
        if (config.Protected.Contains(ProtectedRole.Tier2Subscriber) && subscription.Tier is "2000" or "3000") return true;

        return config.Protected.Contains(ProtectedRole.Tier3Subscriber) && subscription.Tier is "3000";
    }

    private Task RefundAsync(TimeoutRewardConfig config, string broadcasterId, TwitchRedemption redemption, string reason, string accessToken, CancellationToken cancellationToken)
    {
        return redemptions.RefundAsync(config.ChannelId, config.RewardId, redemption, reason, accessToken, cancellationToken);
    }

    private static CustomRewardRequests.Fields Of(TimeoutRewardUpdate update)
    {
        return new CustomRewardRequests.Fields(
            update.Title,
            update.Cost,
            CustomRewardRequests.PromptOrDefault(update.Prompt, DefaultPrompt),
            update.BackgroundColor,
            update.IsEnabled ?? true,
            UserInputRequired: true,
            update.CooldownSeconds,
            update.MaxPerStream,
            update.MaxPerUserPerStream);
    }

    private static string? ParseTarget(string input)
    {
        var word = input.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        if (word is null) return null;

        var login = word.TrimStart('@').ToLowerInvariant();

        if (login.Length is 0 or > 25) return null;
        return login.All(character => character is (>= 'a' and <= 'z') or (>= '0' and <= '9') or '_') ? login : null;
    }
}

public sealed class TimeoutRewardWatcher(
    IServiceScopeFactory scopeFactory,
    ILogger<TimeoutRewardWatcher> logger
) : BackgroundService {

    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var ticks = new PeriodicTimer(Interval);

        while (await ticks.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<TimeoutRewardService>();

                await service.RestoreRolesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "The role restore tick failed");
            }
        }
    }
}