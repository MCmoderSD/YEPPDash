using YEPPDash.Api.Data;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class BdsmService(
    BdsmRepository repository,
    TwitchChannelService channels,
    ILogger<BdsmService> logger)
{
    /// <summary>
    /// Every test the given user has taken, newest first.
    /// </summary>
    public Task<IReadOnlyList<BdsmResult>> GetForUserAsync(string userId, CancellationToken cancellationToken)
    {
        return repository.GetForUserAsync(ParseUserId(userId), cancellationToken);
    }

    /// <summary>
    /// The most recent test of everyone following the given channel, plus the channel owner's own.
    /// </summary>
    /// <remarks>
    /// Built the same way round as the follower birthdays: the stored results are read first and then
    /// checked one by one against Twitch, rather than pulling the channel's whole follower list and
    /// intersecting it. There will almost always be far fewer people who have taken the test than a
    /// channel has followers, so the cost scales with the smaller of the two.
    /// </remarks>
    public async Task<IReadOnlyList<BdsmResult>> GetForFollowersAsync(
        string broadcasterId, CancellationToken cancellationToken)
    {
        var results = await repository.GetLatestPerUserAsync(cancellationToken);
        if (results.Count is 0) return [];

        var matched = new List<BdsmResult>(results.Count);

        // Sequential rather than in parallel: Twitch bills every call against the same rate limit, and
        // a wide fan-out here only trades one slow request for a throttled one.
        foreach (var result in results)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var userId = result.UserId.ToString();

            // Twitch has no notion of following your own channel, so the owner is taken on their id
            // alone rather than a follow check that could never come back true.
            var isOwner = string.Equals(userId, broadcasterId, StringComparison.Ordinal);
            if (isOwner || await channels.GetFollowerAsync(broadcasterId, userId, cancellationToken) is not null)
            {
                matched.Add(result);
            }
        }

        logger.LogInformation(
            "{Matched} of {Stored} stored BDSM results belong to channel {BroadcasterId} or its followers",
            matched.Count, results.Count, broadcasterId);

        return matched;
    }

    /// <remarks>
    /// Safe to parse without a fallback: every route into this service constrains the id to an int,
    /// which is also what the column behind it is.
    /// </remarks>
    private static int ParseUserId(string userId)
    {
        return int.Parse(userId);
    }
}
