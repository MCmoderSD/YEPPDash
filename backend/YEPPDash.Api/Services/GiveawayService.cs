using YEPPDash.Api.Data.Giveaway;
using YEPPDash.Api.Data.Redemption;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.EventSub;
using YEPPDash.Api.Exceptions.Giveaway;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Services.Streaming;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Services;

public sealed class GiveawayService(
    GiveawayRepository repository,
    RedemptionSettlement redemptions,
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

        var reward = await channels.CreateCustomRewardAsync(broadcasterId, CustomRewardRequests.Create(Of(update, enabled: false)), cancellationToken);

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
            reward = await channels.UpdateCustomRewardAsync(broadcasterId, config.RewardId, CustomRewardRequests.Update(Of(update, enabled: false)), cancellationToken);
        }
        catch (TwitchOAuthException exception) when (exception.IsNotFound())
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
            reward = await channels.UpdateCustomRewardAsync(broadcasterId, config.RewardId, CustomRewardRequests.SetEnabled(true), cancellationToken);
        }
        catch (TwitchOAuthException exception) when (exception.IsNotFound())
        {
            reward = await RecreateAsync(config, broadcasterId, enabled: true, cancellationToken);
            config = config with { RewardId = reward.Id };
        }

        config = config with { Status = GiveawayStatus.Open, UpdatedAt = DateTime.UtcNow };
        await repository.SetStatusAsync(config.Id, config.Status, config.UpdatedAt, cancellationToken);

        hub.Publish(channelId, GiveawayEvents.Status(config.Id, config.Status), StreamAudience.Dashboard);

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
            reward = await channels.UpdateCustomRewardAsync(broadcasterId, config.RewardId, CustomRewardRequests.SetEnabled(false), cancellationToken);
        }
        catch (TwitchOAuthException exception) when (exception.IsNotFound())
        {
            logger.LogWarning("Reward {RewardId} of giveaway {GiveawayId} is gone, closing it anyway", config.RewardId, config.Id);
        }

        config = config with { Status = GiveawayStatus.Closed, UpdatedAt = DateTime.UtcNow };
        await repository.SetStatusAsync(config.Id, config.Status, config.UpdatedAt, cancellationToken);

        hub.Publish(channelId, GiveawayEvents.Status(config.Id, config.Status), StreamAudience.Dashboard);

        eventSub.Resync();

        logger.LogInformation("Giveaway {GiveawayId} in channel {ChannelId} is closed for entries", config.Id, channelId);

        return await SettingsAsync(config, broadcasterId, reward, cancellationToken);
    }

    public async Task<bool> DeleteAsync(string broadcasterId, Guid giveawayId, CancellationToken cancellationToken)
    {
        var channelId = int.Parse(broadcasterId);

        var config = await repository.GetAsync(channelId, giveawayId, cancellationToken);
        if (config is null) return false;

        await channels.DeleteIfPresentAsync(broadcasterId, config.RewardId, cancellationToken);

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
            reward = await channels.UpdateCustomRewardAsync(broadcasterId, config.RewardId, CustomRewardRequests.SetEnabled(false), cancellationToken);
        }
        catch (TwitchOAuthException exception) when (exception.IsNotFound())
        {
            logger.LogWarning("Reward {RewardId} of giveaway {GiveawayId} is gone, resetting it anyway", config.RewardId, config.Id);
        }

        await repository.ClearEntriesAsync(config.Id, cancellationToken);

        config = config with { Status = GiveawayStatus.Draft, UpdatedAt = DateTime.UtcNow };
        await repository.SetStatusAsync(config.Id, config.Status, config.UpdatedAt, cancellationToken);

        hub.Publish(channelId, GiveawayEvents.Status(config.Id, config.Status), StreamAudience.Dashboard);
        hub.Publish(
            channelId,
            GiveawayEvents.OverlayState(new GiveawayOverlayState(config.Id, config.Title, [])),
            StreamAudience.Overlay);

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

        hub.Publish(channelId, GiveawayEvents.OverlayState(state), StreamAudience.Overlay);
        hub.Publish(channelId, GiveawayEvents.OverlaySpin(config.Id, index), StreamAudience.Overlay);
        hub.Publish(channelId, GiveawayEvents.Winner(config.Id, drawn), StreamAudience.Dashboard);

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
        hub.Publish(channelId, GiveawayEvents.OverlayDismiss(giveawayId), StreamAudience.Overlay);
    }

    public async Task HandleRedemptionAsync(int channelId, string rewardId, TwitchRedemption redemption, CancellationToken cancellationToken)
    {
        var config = await repository.GetByRewardAsync(channelId, rewardId, cancellationToken);
        if (config is null) return;

        var broadcasterId = channelId.ToString();

        var accessToken = await redemptions.ClaimAsync(channelId, rewardId, redemption, cancellationToken);
        if (accessToken is null) return;

        try
        {
            await RegisterAsync(config, broadcasterId, redemption, accessToken, cancellationToken);
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
            catch (TwitchOAuthException exception) when (exception.IsNotFound())
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

        await redemptions.FulfilAsync(
            config.ChannelId, config.RewardId, redemption, $"entered with x{multiplier:0.##}", accessToken, cancellationToken);

        hub.Publish(
            config.ChannelId,
            GiveawayEvents.Participant(config.Id, Respond(participant, profile)),
            StreamAudience.Dashboard);

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

        hub.Publish(config.ChannelId, GiveawayEvents.OverlayState(state), StreamAudience.Overlay);
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
        catch (TwitchOAuthException exception) when (exception.IsNotFound())
        {
            return null;
        }
    }

    private async Task<CustomReward> RecreateAsync(GiveawayConfig config, string broadcasterId, bool enabled, CancellationToken cancellationToken)
    {
        var reward = await channels.CreateCustomRewardAsync(
            broadcasterId,
            CustomRewardRequests.Create(Of(config, enabled)),
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

    private Task RefundAsync(GiveawayConfig config, string broadcasterId, TwitchRedemption redemption, string reason, string accessToken, CancellationToken cancellationToken)
    {
        return redemptions.RefundAsync(config.ChannelId, config.RewardId, redemption, reason, accessToken, cancellationToken);
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

    // A giveaway never asks the redeemer to type anything: the entry is the redemption itself.
    private static CustomRewardRequests.Fields Of(GiveawayUpdate update, bool enabled)
    {
        return new CustomRewardRequests.Fields(
            update.Title,
            update.Cost,
            CustomRewardRequests.PromptOrDefault(update.Description, DefaultDescription),
            update.BackgroundColor,
            enabled,
            UserInputRequired: false,
            update.CooldownSeconds,
            update.MaxPerStream,
            update.MaxPerUserPerStream);
    }

    private static CustomRewardRequests.Fields Of(GiveawayConfig config, bool enabled)
    {
        return new CustomRewardRequests.Fields(
            config.Title,
            config.Cost,
            CustomRewardRequests.PromptOrDefault(config.Description, DefaultDescription),
            BackgroundColor: null,
            enabled,
            UserInputRequired: false,
            config.CooldownSeconds,
            config.MaxPerStream,
            config.MaxPerUserPerStream);
    }
}