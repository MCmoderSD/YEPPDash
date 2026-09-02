using System.Net;
using YEPPDash.Api.Data.Giveaway;
using YEPPDash.Api.Data.Redemption;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.EventSub;
using YEPPDash.Api.Exceptions.Giveaway;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Services;

public sealed class GiveawayService(
    GiveawayRepository repository,
    RedemptionLogRepository log,
    TwitchChannelService channels,
    TwitchApiClient apiClient,
    TwitchAuthService authService,
    EventSubHost eventSub,
    GiveawayHub hub,
    ILogger<GiveawayService> logger
) {
    private const string DefaultDescription = "Redeem to enter the giveaway.";

    public Task<int> CountAsync(string broadcasterId, CancellationToken cancellationToken)
        => repository.CountAsync(int.Parse(broadcasterId), cancellationToken);

    public async Task<IReadOnlyList<GiveawaySummary>> ListAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var channelId = int.Parse(broadcasterId);

        var configs = await repository.GetChannelAsync(channelId, cancellationToken);
        if (configs.Count is 0) return [];

        var counts = await repository.CountsAsync(channelId, cancellationToken);

        var rewards = await channels.GetCustomRewardsAsync(broadcasterId, [], cancellationToken);

        var known = rewards.ToDictionary(reward => reward.Id, StringComparer.OrdinalIgnoreCase);

        return
        [
            .. configs.Select(config =>
            {
                counts.TryGetValue(config.Id, out var count);
                known.TryGetValue(config.RewardId, out var reward);

                return new GiveawaySummary(
                    config.Id,
                    config.Title,
                    config.Description,
                    config.Status,
                    config.Cost,
                    config.UpdatedAt,
                    count.Participants,
                    count.Winners,
                    reward is null,
                    reward);
            }),
        ];
    }

    public async Task<GiveawaySettings?> GetAsync(string broadcasterId, Guid giveawayId, CancellationToken cancellationToken)
    {
        var config = await repository.GetAsync(int.Parse(broadcasterId), giveawayId, cancellationToken);
        if (config is null) return null;

        return await SettingsAsync(config, broadcasterId, await RewardAsync(config, broadcasterId, cancellationToken), cancellationToken);
    }

    public async Task<GiveawaySettings> CreateAsync(string broadcasterId, GiveawayUpdate update, CancellationToken cancellationToken)
    {
        var channelId = int.Parse(broadcasterId);

        var reward = await channels.CreateCustomRewardAsync(broadcasterId, ToCreate(update, enabled: false), cancellationToken);

        var config = new GiveawayConfig(
            Guid.NewGuid(),
            channelId,
            reward.Id,
            reward.Title,
            reward.Prompt,
            reward.Cost,
            GiveawayStatus.Draft,
            DateTime.UtcNow,
            update.CooldownSeconds,
            update.MaxPerStream,
            update.MaxPerUserPerStream,
            update.Requirements,
            update.Multipliers);

        await repository.InsertAsync(config, cancellationToken);

        eventSub.Resync();

        logger.LogInformation(
            "Giveaway {GiveawayId} created for channel {ChannelId} on reward {RewardId}",
            config.Id, channelId, reward.Id);

        return await SettingsAsync(config, broadcasterId, reward, cancellationToken);
    }

    public async Task<GiveawaySettings?> UpdateAsync(string broadcasterId, Guid giveawayId, GiveawayUpdate update, CancellationToken cancellationToken)
    {
        var config = await repository.GetAsync(int.Parse(broadcasterId), giveawayId, cancellationToken);
        if (config is null) return null;

        if (config.Status is GiveawayStatus.Open) throw new InvalidGiveawayException("Close registration before changing a running giveaway.");

        CustomReward reward;

        try
        {
            reward = await channels.UpdateCustomRewardAsync(broadcasterId, config.RewardId, ToUpdate(update, enabled: false), cancellationToken);
        }
        catch (TwitchOAuthException exception) when (exception.StatusCode is HttpStatusCode.NotFound)
        {
            reward = await RecreateAsync(config, broadcasterId, enabled: false, cancellationToken);
        }

        config = config with
        {
            RewardId = reward.Id,
            Title = reward.Title,
            Description = reward.Prompt,
            Cost = reward.Cost,
            UpdatedAt = DateTime.UtcNow,
            CooldownSeconds = update.CooldownSeconds,
            MaxPerStream = update.MaxPerStream,
            MaxPerUserPerStream = update.MaxPerUserPerStream,
            Requirements = update.Requirements,
            Multipliers = update.Multipliers,
        };

        await repository.UpdateAsync(config, cancellationToken);
        await RecalculateAsync(config, broadcasterId, cancellationToken);

        eventSub.Resync();

        return await SettingsAsync(config, broadcasterId, reward, cancellationToken);
    }

    public async Task<GiveawaySettings?> OpenAsync(string broadcasterId, Guid giveawayId, CancellationToken cancellationToken)
    {
        var channelId = int.Parse(broadcasterId);

        var config = await repository.GetAsync(channelId, giveawayId, cancellationToken);
        if (config is null) return null;

        if (config.Status is GiveawayStatus.Open)
        {
            return await SettingsAsync(config, broadcasterId, await RewardAsync(config, broadcasterId, cancellationToken), cancellationToken);
        }

        CustomReward reward;

        try
        {
            reward = await channels.UpdateCustomRewardAsync(broadcasterId, config.RewardId, EnabledUpdate(true), cancellationToken);
        }
        catch (TwitchOAuthException exception) when (exception.StatusCode is HttpStatusCode.NotFound)
        {
            reward = await RecreateAsync(config, broadcasterId, enabled: true, cancellationToken);
            config = config with { RewardId = reward.Id };
        }

        config = config with { Status = GiveawayStatus.Open, UpdatedAt = DateTime.UtcNow };
        await repository.SetStatusAsync(config.Id, config.Status, config.UpdatedAt, cancellationToken);

        hub.Publish(channelId, GiveawayAudience.Dashboard, GiveawayEvents.Status(config.Id, config.Status));

        eventSub.Resync();

        logger.LogInformation("Giveaway {GiveawayId} in channel {ChannelId} is open for entries", config.Id, channelId);

        return await SettingsAsync(config, broadcasterId, reward, cancellationToken);
    }

    public async Task<GiveawaySettings?> CloseAsync(string broadcasterId, Guid giveawayId, CancellationToken cancellationToken)
    {
        var channelId = int.Parse(broadcasterId);

        var config = await repository.GetAsync(channelId, giveawayId, cancellationToken);
        if (config is null) return null;

        if (config.Status is GiveawayStatus.Draft) throw new InvalidGiveawayException("A draft giveaway was never open.");

        if (config.Status is GiveawayStatus.Closed)
        {
            return await SettingsAsync(config, broadcasterId, await RewardAsync(config, broadcasterId, cancellationToken), cancellationToken);
        }

        CustomReward? reward = null;

        try
        {
            reward = await channels.UpdateCustomRewardAsync(broadcasterId, config.RewardId, EnabledUpdate(false), cancellationToken);
        }
        catch (TwitchOAuthException exception) when (exception.StatusCode is HttpStatusCode.NotFound)
        {
            logger.LogWarning("Reward {RewardId} of giveaway {GiveawayId} is gone, closing it anyway", config.RewardId, config.Id);
        }

        config = config with { Status = GiveawayStatus.Closed, UpdatedAt = DateTime.UtcNow };
        await repository.SetStatusAsync(config.Id, config.Status, config.UpdatedAt, cancellationToken);

        hub.Publish(channelId, GiveawayAudience.Dashboard, GiveawayEvents.Status(config.Id, config.Status));

        eventSub.Resync();

        logger.LogInformation("Giveaway {GiveawayId} in channel {ChannelId} is closed for entries", config.Id, channelId);

        return await SettingsAsync(config, broadcasterId, reward, cancellationToken);
    }

    public async Task<bool> DeleteAsync(string broadcasterId, Guid giveawayId, CancellationToken cancellationToken)
    {
        var channelId = int.Parse(broadcasterId);

        var config = await repository.GetAsync(channelId, giveawayId, cancellationToken);
        if (config is null) return false;

        try
        {
            await channels.DeleteCustomRewardAsync(broadcasterId, config.RewardId, cancellationToken);
        }
        catch (TwitchOAuthException exception) when (exception.StatusCode is HttpStatusCode.NotFound)
        {
        }

        await repository.DeleteAsync(config.Id, cancellationToken);

        Dismiss(channelId, config.Id);

        eventSub.Resync();

        logger.LogInformation("Giveaway {GiveawayId} in channel {ChannelId} was deleted", config.Id, channelId);

        return true;
    }

    public async Task<bool> RemoveParticipantAsync(string broadcasterId, Guid giveawayId, string userId, CancellationToken cancellationToken)
    {
        var config = await repository.GetAsync(int.Parse(broadcasterId), giveawayId, cancellationToken);
        if (config is null) return false;

        if (!await repository.RemoveParticipantAsync(giveawayId, userId, cancellationToken)) return false;

        await RefreshOverlayAsync(config, broadcasterId, cancellationToken);

        return true;
    }

    public async Task<GiveawaySettings?> ResetAsync(string broadcasterId, Guid giveawayId, CancellationToken cancellationToken)
    {
        var channelId = int.Parse(broadcasterId);

        var config = await repository.GetAsync(channelId, giveawayId, cancellationToken);
        if (config is null) return null;

        CustomReward? reward = null;

        try
        {
            reward = await channels.UpdateCustomRewardAsync(broadcasterId, config.RewardId, EnabledUpdate(false), cancellationToken);
        }
        catch (TwitchOAuthException exception) when (exception.StatusCode is HttpStatusCode.NotFound)
        {
            logger.LogWarning("Reward {RewardId} of giveaway {GiveawayId} is gone, resetting it anyway", config.RewardId, config.Id);
        }

        await repository.ClearEntriesAsync(config.Id, cancellationToken);

        config = config with { Status = GiveawayStatus.Draft, UpdatedAt = DateTime.UtcNow };
        await repository.SetStatusAsync(config.Id, config.Status, config.UpdatedAt, cancellationToken);

        hub.Publish(channelId, GiveawayAudience.Dashboard, GiveawayEvents.Status(config.Id, config.Status));
        hub.Publish(
            channelId,
            GiveawayAudience.Overlay,
            GiveawayEvents.OverlayState(new GiveawayOverlayState(config.Id, config.Title, [])));

        eventSub.Resync();

        logger.LogInformation("Giveaway {GiveawayId} in channel {ChannelId} was reset to a draft", config.Id, channelId);

        return await SettingsAsync(config, broadcasterId, reward, cancellationToken);
    }

    public async Task<GiveawayDrawResponse?> DrawAsync(string broadcasterId, Guid giveawayId, CancellationToken cancellationToken)
    {
        var channelId = int.Parse(broadcasterId);

        var config = await repository.GetAsync(channelId, giveawayId, cancellationToken);
        if (config is null) return null;

        if (config.Status is not GiveawayStatus.Closed)
        {
            throw new InvalidGiveawayException("Winners can only be drawn once the giveaway is closed.");
        }

        var participants = await repository.GetParticipantsAsync(giveawayId, cancellationToken);
        if (participants.Count is 0) throw new InvalidGiveawayException("There is nobody to draw from.");

        var profiles = await ProfilesAsync(broadcasterId, [.. participants.Select(participant => participant.UserId)], cancellationToken);

        var index = Pick(participants);
        var chosen = participants[index];

        var winner = await repository.AddWinnerAsync(
            new GiveawayWinnerRecord(config.Id, 0, chosen.UserId, LabelOf(chosen, profiles), chosen.Multiplier, DateTime.UtcNow),
            cancellationToken);

        var drawn = Respond(winner, profiles);
        var state = new GiveawayOverlayState(config.Id, config.Title, SlicesOf(participants, profiles));

        hub.Publish(channelId, GiveawayAudience.Overlay, GiveawayEvents.OverlayState(state));
        hub.Publish(channelId, GiveawayAudience.Overlay, GiveawayEvents.OverlaySpin(config.Id, index));
        hub.Publish(channelId, GiveawayAudience.Dashboard, GiveawayEvents.Winner(config.Id, drawn));

        logger.LogInformation(
            "Giveaway {GiveawayId} in channel {ChannelId} drew {UserId} as winner {DrawOrder}",
            config.Id, channelId, winner.UserId, winner.DrawOrder);

        return new GiveawayDrawResponse(index, drawn, state.Slices);
    }

    public async Task<GiveawayOverlayState?> OverlayAsync(Guid giveawayId, CancellationToken cancellationToken)
    {
        var config = await repository.FindAsync(giveawayId, cancellationToken);
        if (config is null) return null;

        var participants = await repository.GetParticipantsAsync(giveawayId, cancellationToken);

        return await OverlayOf(config, config.ChannelId.ToString(), participants, cancellationToken);
    }
    
    public async Task<int?> ChannelOfAsync(Guid giveawayId, CancellationToken cancellationToken)
        => (await repository.FindAsync(giveawayId, cancellationToken))?.ChannelId;

    public void Dismiss(int channelId, Guid giveawayId)
    {
        hub.Publish(channelId, GiveawayAudience.Overlay, GiveawayEvents.OverlayDismiss(giveawayId));
    }

    public async Task HandleRedemptionAsync(int channelId, string rewardId, TwitchRedemption redemption, CancellationToken cancellationToken)
    {
        var config = await repository.GetByRewardAsync(channelId, rewardId, cancellationToken);
        if (config is null) return;

        var broadcasterId = channelId.ToString();

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
            await RegisterAsync(config, broadcasterId, redemption, token.AccessToken, cancellationToken);
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

    public async Task CatchUpAsync(int channelId, CancellationToken cancellationToken)
    {
        var configs = await repository.GetActiveChannelAsync(channelId, cancellationToken);
        if (configs.Count is 0) return;

        var broadcasterId = channelId.ToString();

        var token = await authService.GetValidTokenAsync(broadcasterId, cancellationToken);
        if (token is null) return;

        foreach (var config in configs)
        {
            cancellationToken.ThrowIfCancellationRequested();

            IReadOnlyList<TwitchRedemption> open;

            try
            {
                open = await apiClient.GetRedemptionsAsync(
                    broadcasterId, config.RewardId, RedemptionStatus.Unfulfilled, token.AccessToken, cancellationToken);
            }
            catch (TwitchOAuthException exception) when (exception.StatusCode is HttpStatusCode.NotFound)
            {
                logger.LogWarning(
                    "Reward {RewardId} of giveaway {GiveawayId} is gone from Twitch, the giveaway and its history stay",
                    config.RewardId, config.Id);

                continue;
            }

            foreach (var redemption in open)
            {
                await HandleRedemptionAsync(channelId, config.RewardId, redemption, cancellationToken);
            }
        }
    }

    private async Task RegisterAsync(GiveawayConfig config, string broadcasterId, TwitchRedemption redemption, string accessToken, CancellationToken cancellationToken)
    {
        if (config.Status is GiveawayStatus.Draft)
        {
            await RefundAsync(config, broadcasterId, redemption, "registration has not started", accessToken, cancellationToken);
            return;
        }

        if (config.Status is GiveawayStatus.Closed)
        {
            await RefundAsync(config, broadcasterId, redemption, "registration is closed", accessToken, cancellationToken);
            return;
        }

        if (await repository.HasParticipantAsync(config.Id, redemption.UserId, cancellationToken))
        {
            await RefundAsync(config, broadcasterId, redemption, "already entered this giveaway", accessToken, cancellationToken);
            return;
        }

        var found = await channels.GetUserProfilesAsync(broadcasterId, [redemption.UserId], [], cancellationToken);
        var profile = found.Count > 0 ? found[0] : null;

        var isVip = profile?.Roles?.Vip == true;
        var isModerator = profile?.Roles?.Moderator == true;
        var isFollower = await channels.GetFollowerAsync(broadcasterId, redemption.UserId, cancellationToken) is not null;

        var subscription = await apiClient.GetSubscriptionAsync(broadcasterId, redemption.UserId, accessToken, cancellationToken);
        var subTier = SubscriptionTiers.FromTwitch(subscription?.Tier);

        if (Rejection(config.Requirements, isFollower, subTier, isVip, isModerator) is { } rejection)
        {
            await RefundAsync(config, broadcasterId, redemption, rejection, accessToken, cancellationToken);
            return;
        }

        var multiplier = MultiplierFor(config.Multipliers, isFollower, subTier, isVip, isModerator);

        var participant = new GiveawayParticipantRecord(
            config.Id,
            redemption.UserId,
            profile?.DisplayName ?? redemption.UserName,
            redemption.Id,
            isFollower,
            subTier,
            isVip,
            isModerator,
            multiplier,
            DateTime.UtcNow);

        if (!await repository.AddParticipantAsync(participant, cancellationToken))
        {
            await RefundAsync(config, broadcasterId, redemption, "already entered this giveaway", accessToken, cancellationToken);
            return;
        }

        await SettleAsync(config, broadcasterId, redemption, RedemptionStatus.Fulfilled, accessToken, cancellationToken);
        await log.MarkAsync(redemption.Id, RedemptionStatus.Fulfilled, $"entered with x{multiplier:0.##}", cancellationToken);

        hub.Publish(
            config.ChannelId,
            GiveawayAudience.Dashboard,
            GiveawayEvents.Participant(config.Id, Respond(participant, profile)));

        await RefreshOverlayAsync(config, broadcasterId, cancellationToken);

        logger.LogInformation(
            "{UserId} entered giveaway {GiveawayId} in channel {ChannelId} with x{Multiplier}",
            redemption.UserId, config.Id, config.ChannelId, multiplier);
    }

    private static string? Rejection(GiveawayRequirements requirements, bool isFollower, SubscriptionTier subTier, bool isVip, bool isModerator)
    {
        return Check(requirements.Follower, isFollower, "not a follower", "followers are excluded")
            ?? Check(requirements.Subscriber, subTier is not SubscriptionTier.None, "not a subscriber", "subscribers are excluded")
            ?? Check(requirements.Tier2, subTier is SubscriptionTier.Tier2 or SubscriptionTier.Tier3, "not a Tier 2 or higher subscriber", "Tier 2 and higher subscribers are excluded")
            ?? Check(requirements.Tier3, subTier is SubscriptionTier.Tier3, "not a Tier 3 subscriber", "Tier 3 subscribers are excluded")
            ?? Check(requirements.Vip, isVip, "not a VIP", "VIPs are excluded")
            ?? Check(requirements.Moderator, isModerator, "not a moderator", "moderators are excluded");
    }

    private static string? Check(RequirementState state, bool holds, string missing, string excluded)
    {
        return state switch
        {
            RequirementState.Required when !holds => missing,
            RequirementState.Excluded when holds => excluded,
            _ => null,
        };
    }

    private static double MultiplierFor(GiveawayMultipliers multipliers, bool isFollower, SubscriptionTier subTier, bool isVip, bool isModerator)
    {
        var multiplier = multipliers.Base;

        if (isFollower) multiplier *= multipliers.Follower;
        if (subTier is not SubscriptionTier.None) multiplier *= multipliers.Subscriber;
        if (subTier is SubscriptionTier.Tier2) multiplier *= multipliers.Tier2;
        if (subTier is SubscriptionTier.Tier3) multiplier *= multipliers.Tier3;
        if (isVip) multiplier *= multipliers.Vip;
        if (isModerator) multiplier *= multipliers.Moderator;

        return multiplier;
    }

    private static int Pick(IReadOnlyList<GiveawayParticipantRecord> participants)
    {
        var total = participants.Sum(participant => participant.Multiplier);
        if (total <= 0) return Random.Shared.Next(participants.Count);

        var roll = Random.Shared.NextDouble() * total;
        var running = 0d;

        for (var index = 0; index < participants.Count - 1; index++)
        {
            running += participants[index].Multiplier;
            if (roll < running) return index;
        }

        for (var index = participants.Count - 1; index > 0; index--)
        {
            if (participants[index].Multiplier > 0) return index;
        }

        return 0;
    }

    private async Task RecalculateAsync(GiveawayConfig config, string broadcasterId, CancellationToken cancellationToken)
    {
        var participants = await repository.GetParticipantsAsync(config.Id, cancellationToken);
        var changed = 0;

        foreach (var participant in participants)
        {
            var multiplier = MultiplierFor(config.Multipliers, participant.IsFollower, participant.SubTier, participant.IsVip, participant.IsModerator);

            if (multiplier.Equals(participant.Multiplier)) continue;

            await repository.SetParticipantMultiplierAsync(config.Id, participant.UserId, multiplier, cancellationToken);
            changed++;
        }

        if (changed is 0) return;

        logger.LogInformation(
            "Reweighed {Changed} of {Total} entries in giveaway {GiveawayId}", changed, participants.Count, config.Id);

        await RefreshOverlayAsync(config, broadcasterId, cancellationToken);
    }

    private async Task RefreshOverlayAsync(GiveawayConfig config, string broadcasterId, CancellationToken cancellationToken)
    {
        var participants = await repository.GetParticipantsAsync(config.Id, cancellationToken);
        var state = await OverlayOf(config, broadcasterId, participants, cancellationToken);

        hub.Publish(config.ChannelId, GiveawayAudience.Overlay, GiveawayEvents.OverlayState(state));
    }

    private async Task<GiveawayOverlayState> OverlayOf(GiveawayConfig config, string broadcasterId, IReadOnlyList<GiveawayParticipantRecord> participants, CancellationToken cancellationToken)
    {
        var profiles = await ProfilesAsync(broadcasterId, [.. participants.Select(participant => participant.UserId)], cancellationToken);

        return new GiveawayOverlayState(config.Id, config.Title, SlicesOf(participants, profiles));
    }

    private async Task<GiveawaySettings> SettingsAsync(GiveawayConfig config, string broadcasterId, CustomReward? reward, CancellationToken cancellationToken)
    {
        var participants = await repository.GetParticipantsAsync(config.Id, cancellationToken);
        var winners = await repository.GetWinnersAsync(config.Id, cancellationToken);

        string[] ids =
        [
            .. participants.Select(participant => participant.UserId)
                .Concat(winners.Select(winner => winner.UserId))
                .Distinct(StringComparer.Ordinal),
        ];

        var profiles = await ProfilesAsync(broadcasterId, ids, cancellationToken);

        return new GiveawaySettings(
            config.Id,
            config.Status,
            config.UpdatedAt,
            reward,
            reward is null,
            config.Title,
            config.Description,
            config.Cost,
            config.CooldownSeconds,
            config.MaxPerStream,
            config.MaxPerUserPerStream,
            config.Requirements,
            config.Multipliers,
            [.. participants.Select(participant => Respond(participant, Profile(participant.UserId, profiles)))],
            [.. winners.Select(winner => Respond(winner, profiles))]);
    }

    private async Task<CustomReward?> RewardAsync(GiveawayConfig config, string broadcasterId, CancellationToken cancellationToken)
    {
        try
        {
            var rewards = await channels.GetCustomRewardsAsync(broadcasterId, [config.RewardId], cancellationToken);
            return rewards.Count > 0 ? rewards[0] : null;
        }
        catch (TwitchOAuthException exception) when (exception.StatusCode is HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    private async Task<CustomReward> RecreateAsync(GiveawayConfig config, string broadcasterId, bool enabled, CancellationToken cancellationToken)
    {
        var reward = await channels.CreateCustomRewardAsync(
            broadcasterId,
            new CustomRewardCreate
            {
                Title = config.Title,
                Cost = config.Cost,
                Prompt = string.IsNullOrWhiteSpace(config.Description) ? DefaultDescription : config.Description,
                IsEnabled = enabled,
                IsUserInputRequired = false,
                ShouldRedemptionsSkipRequestQueue = false,
                IsGlobalCooldownEnabled = config.CooldownSeconds > 0,
                GlobalCooldownSeconds = config.CooldownSeconds > 0 ? config.CooldownSeconds : null,
                IsMaxPerStreamEnabled = config.MaxPerStream > 0,
                MaxPerStream = config.MaxPerStream > 0 ? config.MaxPerStream : null,
                IsMaxPerUserPerStreamEnabled = config.MaxPerUserPerStream > 0,
                MaxPerUserPerStream = config.MaxPerUserPerStream > 0 ? config.MaxPerUserPerStream : null,
            },
            cancellationToken);

        await repository.SetRewardAsync(config.Id, reward.Id, DateTime.UtcNow, cancellationToken);

        logger.LogInformation(
            "Reward {OldRewardId} of giveaway {GiveawayId} was gone and has been created again as {RewardId}",
            config.RewardId, config.Id, reward.Id);

        return reward;
    }

    private async Task<IReadOnlyDictionary<string, TwitchUser>> ProfilesAsync(string broadcasterId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        if (userIds.Count is 0) return new Dictionary<string, TwitchUser>(StringComparer.Ordinal);

        try
        {
            var users = await channels.GetUserProfilesAsync(broadcasterId, userIds, [], cancellationToken);
            return users.ToDictionary(user => user.Id, StringComparer.Ordinal);
        }
        catch (TwitchOAuthException exception)
        {
            logger.LogWarning(
                "Could not read the profiles of {Count} entrants in channel {BroadcasterId} ({StatusCode})",
                userIds.Count, broadcasterId, exception.StatusCode);

            return new Dictionary<string, TwitchUser>(StringComparer.Ordinal);
        }
    }

    private async Task RefundAsync(GiveawayConfig config, string broadcasterId, TwitchRedemption redemption, string reason, string accessToken, CancellationToken cancellationToken)
    {
        var refunded = await SettleAsync(config, broadcasterId, redemption, RedemptionStatus.Canceled, accessToken, cancellationToken);
        if (!refunded) return;

        await log.MarkAsync(redemption.Id, RedemptionStatus.Canceled, reason, cancellationToken);

        logger.LogInformation(
            "Refunded redemption {RedemptionId} in channel {ChannelId} by {RedeemerId}: {Reason}",
            redemption.Id, config.ChannelId, redemption.UserId, reason);
    }

    private async Task<bool> SettleAsync(GiveawayConfig config, string broadcasterId, TwitchRedemption redemption, string status, string accessToken, CancellationToken cancellationToken)
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

    private static IReadOnlyList<GiveawayOverlaySlice> SlicesOf(IReadOnlyList<GiveawayParticipantRecord> participants, IReadOnlyDictionary<string, TwitchUser> profiles)
    {
        return [.. participants.Select(participant => new GiveawayOverlaySlice(LabelOf(participant, profiles), participant.Multiplier))];
    }

    private static string LabelOf(GiveawayParticipantRecord participant, IReadOnlyDictionary<string, TwitchUser> profiles)
    {
        return profiles.TryGetValue(participant.UserId, out var user) ? user.DisplayName : participant.UserName;
    }

    private static TwitchUser? Profile(string userId, IReadOnlyDictionary<string, TwitchUser> profiles)
    {
        return profiles.TryGetValue(userId, out var user) ? user : null;
    }

    private static GiveawayParticipantResponse Respond(GiveawayParticipantRecord participant, TwitchUser? user)
    {
        return new GiveawayParticipantResponse(
            participant.UserId,
            participant.UserName,
            participant.RedemptionId,
            participant.IsFollower,
            participant.SubTier,
            participant.IsVip,
            participant.IsModerator,
            participant.Multiplier,
            participant.EnteredAt,
            user);
    }

    private static GiveawayWinnerResponse Respond(GiveawayWinnerRecord winner, IReadOnlyDictionary<string, TwitchUser> profiles)
    {
        return new GiveawayWinnerResponse(
            winner.DrawOrder,
            winner.UserId,
            winner.UserName,
            winner.Multiplier,
            winner.WonAt,
            Profile(winner.UserId, profiles));
    }

    private static CustomRewardCreate ToCreate(GiveawayUpdate update, bool enabled)
    {
        return new CustomRewardCreate
        {
            Title = update.Title,
            Cost = update.Cost,
            Prompt = DescriptionOf(update),
            BackgroundColor = update.BackgroundColor,
            IsEnabled = enabled,

            IsUserInputRequired = false,
            ShouldRedemptionsSkipRequestQueue = false,

            IsGlobalCooldownEnabled = update.CooldownSeconds > 0,
            GlobalCooldownSeconds = update.CooldownSeconds > 0 ? update.CooldownSeconds : null,
            IsMaxPerStreamEnabled = update.MaxPerStream > 0,
            MaxPerStream = update.MaxPerStream > 0 ? update.MaxPerStream : null,
            IsMaxPerUserPerStreamEnabled = update.MaxPerUserPerStream > 0,
            MaxPerUserPerStream = update.MaxPerUserPerStream > 0 ? update.MaxPerUserPerStream : null,
        };
    }

    private static CustomRewardUpdate ToUpdate(GiveawayUpdate update, bool enabled)
    {
        return new CustomRewardUpdate
        {
            Title = update.Title,
            Cost = update.Cost,
            Prompt = DescriptionOf(update),
            BackgroundColor = update.BackgroundColor,
            IsEnabled = enabled,

            IsUserInputRequired = false,
            ShouldRedemptionsSkipRequestQueue = false,

            IsGlobalCooldownEnabled = update.CooldownSeconds > 0,
            GlobalCooldownSeconds = update.CooldownSeconds > 0 ? update.CooldownSeconds : null,
            IsMaxPerStreamEnabled = update.MaxPerStream > 0,
            MaxPerStream = update.MaxPerStream > 0 ? update.MaxPerStream : null,
            IsMaxPerUserPerStreamEnabled = update.MaxPerUserPerStream > 0,
            MaxPerUserPerStream = update.MaxPerUserPerStream > 0 ? update.MaxPerUserPerStream : null,
        };
    }

    private static CustomRewardUpdate EnabledUpdate(bool enabled)
    {
        return new CustomRewardUpdate { IsEnabled = enabled };
    }

    private static string DescriptionOf(GiveawayUpdate update)
    {
        return string.IsNullOrWhiteSpace(update.Description) ? DefaultDescription : update.Description;
    }
}