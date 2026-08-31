using System.Globalization;
using YEPPDash.Api.Data.Raid;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class RaidService(
    RaidRepository repository,
    TwitchChannelService channels,
    ILogger<RaidService> logger
) {
    public async Task<int> CountForChannelAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        return int.TryParse(broadcasterId, out var channelId)
            ? await repository.CountForChannelAsync(channelId, cancellationToken)
            : 0;
    }

    public async Task<IReadOnlyList<RaidResponse>> GetForChannelAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        if (!int.TryParse(broadcasterId, out var channelId)) return [];

        var raids = await repository.GetForChannelAsync(channelId, cancellationToken);
        if (raids.Count is 0) return [];

        var raiderIds = raids
            .Select(raid => raid.RaiderId.ToString(CultureInfo.InvariantCulture))
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        var profiles = await channels.GetUserProfilesAsync(broadcasterId, raiderIds, [], cancellationToken);
        var byId = profiles.ToDictionary(user => user.Id, StringComparer.Ordinal);

        var resolved = new List<RaidResponse>(raids.Count);

        foreach (var raid in raids)
        {
            if (byId.TryGetValue(raid.RaiderId.ToString(CultureInfo.InvariantCulture), out var raider))
            {
                resolved.Add(RaidResponse.From(raid, raider));
            }
        }

        if (resolved.Count != raids.Count)
        {
            logger.LogInformation(
                "Left out {Dropped} of {Raids} raids of channel {BroadcasterId}: Twitch no longer resolves the account behind them",
                raids.Count - resolved.Count, raids.Count, broadcasterId);
        }

        logger.LogDebug(
            "Resolved {Resolved} of {Raiders} raiders behind {Raids} raids of channel {BroadcasterId}",
            byId.Count, raiderIds.Length, raids.Count, broadcasterId);

        return resolved;
    }
}