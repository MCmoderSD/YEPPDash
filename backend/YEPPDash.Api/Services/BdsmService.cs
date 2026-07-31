using YEPPDash.Api.Data.Bdsm;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class BdsmService(
    BdsmRepository repository,
    TwitchChannelService channels,
    ILogger<BdsmService> logger)
{

    public Task<IReadOnlyList<BdsmResult>> GetForUserAsync(string userId, CancellationToken cancellationToken)
    {
        return repository.GetForUserAsync(int.Parse(userId), cancellationToken);
    }

    public async Task<IReadOnlyList<BdsmResult>> GetForFollowersAsync(
        string broadcasterId, CancellationToken cancellationToken)
    {
        var results = await repository.GetLatestPerUserAsync(cancellationToken);
        if (results.Count is 0) return [];

        var matched = new List<BdsmResult>(results.Count);

        foreach (var result in results)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var userId = result.UserId.ToString();

            var isOwner = string.Equals(userId, broadcasterId, StringComparison.Ordinal);
            if (isOwner || await channels.GetFollowerAsync(broadcasterId, userId, cancellationToken) is not null)
            {
                matched.Add(result);
            }
        }

        logger.LogInformation("{Matched} of {Stored} stored BDSM results belong to channel {BroadcasterId} or its followers", matched.Count, results.Count, broadcasterId);

        return matched;
    }
}