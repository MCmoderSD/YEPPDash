using System.Net;
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

    public async Task<TimeoutRewardSettings?> GetAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var config = await repository.GetAsync(int.Parse(broadcasterId), cancellationToken);
        if (config is null) return null;

        try
        {
            var rewards = await channels.GetCustomRewardsAsync(broadcasterId, [config.RewardId], cancellationToken);
            if (rewards.Count > 0) return new TimeoutRewardSettings(rewards[0], config.DurationSeconds, [.. config.Protected]);
        }
        catch (TwitchOAuthException exception) when (exception.StatusCode is HttpStatusCode.NotFound)
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
            reward = await channels.CreateCustomRewardAsync(broadcasterId, ToCreate(update), cancellationToken);
        }
        else
        {
            try
            {
                reward = await channels.UpdateCustomRewardAsync(broadcasterId, existing.RewardId, ToUpdate(update), cancellationToken);
            }
            catch (TwitchOAuthException exception) when (exception.StatusCode is HttpStatusCode.NotFound)
            {
                reward = await channels.CreateCustomRewardAsync(broadcasterId, ToCreate(update), cancellationToken);
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

        try
        {
            await channels.DeleteCustomRewardAsync(broadcasterId, config.RewardId, cancellationToken);
        }
        catch (TwitchOAuthException exception) when (exception.StatusCode is HttpStatusCode.NotFound)
        {
        }

        await repository.DeleteAsync(channelId, cancellationToken);

        eventSub.Resync();

        logger.LogInformation("Timeout reward removed for channel {BroadcasterId}", broadcasterId);
    }

    public async Task HandleRedemptionAsync(int channelId, string rewardId, TwitchRedemption redemption, CancellationToken cancellationToken)
    {
        var config = await repository.GetAsync(channelId, cancellationToken);
        if (config is null || !string.Equals(config.RewardId, rewardId, StringComparison.Ordinal)) return;

        var broadcasterId = channelId.ToString();

        // Claimed only once there is something to act with: claiming first would mark a redemption
        // as taken that nothing can touch, and leave it sitting open.
        var token = await authService.GetValidTokenAsync(broadcasterId, cancellationToken);
        if (token is null)
        {
            logger.LogWarning(
                "Channel {ChannelId} has no usable Twitch token, leaving redemption {RedemptionId} open",
                channelId, redemption.Id);

            return;
        }

        var claimed = await log.TryRecordAsync(
            new RedemptionRecord(
                redemption.Id, channelId, rewardId, redemption.UserId, redemption.UserInput, redemption.RedeemedAt.UtcDateTime),
            cancellationToken);

        if (!claimed)
        {
            logger.LogDebug("Redemption {RedemptionId} in channel {ChannelId} was already handled", redemption.Id, channelId);
            return;
        }

        try
        {
            await HandleRedemptionAsync(config, broadcasterId, redemption, token.AccessToken, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Handling redemption {RedemptionId} in channel {ChannelId} failed", redemption.Id, channelId);

            await RefundAsync(config, broadcasterId, redemption, "handling it failed", token.AccessToken, cancellationToken);
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
        catch (TwitchOAuthException exception) when (exception.StatusCode is HttpStatusCode.NotFound)
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

            if (!await SettleAsync(config, broadcasterId, redemption, RedemptionStatus.Canceled, token.AccessToken, cancellationToken)) continue;

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
                await SettleAsync(config, broadcasterId, redemption, RedemptionStatus.Fulfilled, accessToken, cancellationToken);
                await log.MarkAsync(redemption.Id, RedemptionStatus.Fulfilled, $"{target.Id} was already banned", cancellationToken);

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

        await SettleAsync(config, broadcasterId, redemption, RedemptionStatus.Fulfilled, accessToken, cancellationToken);
        await log.MarkAsync(redemption.Id, RedemptionStatus.Fulfilled, $"timed out {target.Id} for {config.DurationSeconds}s", cancellationToken);

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

    private async Task RefundAsync(TimeoutRewardConfig config, string broadcasterId, TwitchRedemption redemption, string reason, string accessToken, CancellationToken cancellationToken)
    {
        var refunded = await SettleAsync(config, broadcasterId, redemption, RedemptionStatus.Canceled, accessToken, cancellationToken);
        if (!refunded) return;

        await log.MarkAsync(redemption.Id, RedemptionStatus.Canceled, reason, cancellationToken);

        logger.LogInformation(
            "Refunded redemption {RedemptionId} in channel {ChannelId} by {RedeemerId}: {Reason}",
            redemption.Id, config.ChannelId, redemption.UserId, reason);
    }

    private async Task<bool> SettleAsync(TimeoutRewardConfig config, string broadcasterId, TwitchRedemption redemption, string status, string accessToken, CancellationToken cancellationToken)
    {
        try
        {
            await apiClient.UpdateRedemptionStatusAsync(broadcasterId, config.RewardId, redemption.Id, status, accessToken, cancellationToken);
            return true;
        }
        catch (TwitchOAuthException exception)
        {
            logger.LogWarning(
                "Could not mark redemption {RedemptionId} as {Status} in channel {ChannelId} ({StatusCode})",
                redemption.Id, status, config.ChannelId, exception.StatusCode);

            return false;
        }
    }

    private static CustomRewardCreate ToCreate(TimeoutRewardUpdate update)
    {
        return new CustomRewardCreate
        {
            Title = update.Title,
            Cost = update.Cost,
            Prompt = PromptOf(update),
            BackgroundColor = update.BackgroundColor,
            IsEnabled = update.IsEnabled ?? true,

            IsUserInputRequired = true,
            ShouldRedemptionsSkipRequestQueue = false,

            IsGlobalCooldownEnabled = update.CooldownSeconds > 0,
            GlobalCooldownSeconds = update.CooldownSeconds > 0 ? update.CooldownSeconds : null,
            IsMaxPerStreamEnabled = update.MaxPerStream > 0,
            MaxPerStream = update.MaxPerStream > 0 ? update.MaxPerStream : null,
            IsMaxPerUserPerStreamEnabled = update.MaxPerUserPerStream > 0,
            MaxPerUserPerStream = update.MaxPerUserPerStream > 0 ? update.MaxPerUserPerStream : null,
        };
    }

    private static CustomRewardUpdate ToUpdate(TimeoutRewardUpdate update)
    {
        return new CustomRewardUpdate
        {
            Title = update.Title,
            Cost = update.Cost,
            Prompt = PromptOf(update),
            BackgroundColor = update.BackgroundColor,
            IsEnabled = update.IsEnabled ?? true,

            IsUserInputRequired = true,
            ShouldRedemptionsSkipRequestQueue = false,

            IsGlobalCooldownEnabled = update.CooldownSeconds > 0,
            GlobalCooldownSeconds = update.CooldownSeconds > 0 ? update.CooldownSeconds : null,
            IsMaxPerStreamEnabled = update.MaxPerStream > 0,
            MaxPerStream = update.MaxPerStream > 0 ? update.MaxPerStream : null,
            IsMaxPerUserPerStreamEnabled = update.MaxPerUserPerStream > 0,
            MaxPerUserPerStream = update.MaxPerUserPerStream > 0 ? update.MaxPerUserPerStream : null,
        };
    }

    private static string PromptOf(TimeoutRewardUpdate update)
    {
        return string.IsNullOrWhiteSpace(update.Prompt)
            ? "Type the name of the user to time out — @name works too."
            : update.Prompt;
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