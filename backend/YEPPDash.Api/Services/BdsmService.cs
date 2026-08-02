using YEPPDash.Api.Data.Bdsm;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class BdsmService(
    BdsmRepository repository,
    TwitchChannelService channels,
    ILogger<BdsmService> logger
) {

    public Task<IReadOnlyList<BdsmResult>> GetForUserAsync(string userId, CancellationToken cancellationToken)
    {
        return repository.GetForUserAsync(int.Parse(userId), cancellationToken);
    }

    public async Task<IReadOnlyList<BdsmResult>> GetForFollowersAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var results = await repository.GetLatestPerUserAsync(cancellationToken);
        if (results.Count is 0) return [];

        var followers = await channels.GetFollowersAsync(broadcasterId, cancellationToken);

        var following = new HashSet<int>();

        if (int.TryParse(broadcasterId, out var owner)) following.Add(owner);

        foreach (var follower in followers)
        {
            if (int.TryParse(follower.UserId, out var id)) following.Add(id);
        }

        var matched = results.Where(result => following.Contains(result.UserId)).ToList();

        logger.LogInformation(
            "{Matched} of {Stored} stored BDSM results belong to channel {BroadcasterId} or its {Followers} followers",
            matched.Count, results.Count, broadcasterId, followers.Count);

        return matched;
    }
}