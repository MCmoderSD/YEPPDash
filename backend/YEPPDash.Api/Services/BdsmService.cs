using MCmoderSD.BdsmTestApi.Core;
using MCmoderSD.BdsmTestApi.Data;
using MCmoderSD.BdsmTestApi.Exceptions;
using YEPPDash.Api.Data.Bdsm;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class BdsmService(
    BdsmRepository repository,
    BdsmTestApi api,
    BdsmResultCache cache,
    TwitchChannelService channels,
    ILogger<BdsmService> logger
) {

    // BDSMTest.org is somebody else's server and a match already costs it three requests, so the
    // fan-out is kept low even when a whole channel is being listed.
    private const int MaxParallelFetches = 4;

    public async Task<IReadOnlyList<BdsmUserResult>> GetForUserAsync(string userId, CancellationToken cancellationToken)
    {
        if (!TryParse(userId, out var parsed)) return [];

        return await ResolveAsync(await repository.GetForUserAsync(parsed, cancellationToken), cancellationToken);
    }

    // The newest result per user rather than every one of them: this backs a listing of many
    // people, and each extra row is another request to BDSMTest.org.
    public async Task<IReadOnlyList<BdsmUserResult>> GetForUsersAsync(IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        var parsed = Parse(userIds);
        if (parsed.Count is 0) return [];

        return await ResolveAsync(await repository.GetLatestForUsersAsync(parsed, cancellationToken), cancellationToken);
    }

    public async Task<BdsmUserMatch?> MatchAsync(string userId, string partnerId, CancellationToken cancellationToken)
    {
        var matches = await MatchPairsAsync([new BdsmPair(userId, partnerId)], cancellationToken);
        return matches.Count is 0 ? null : matches[0];
    }

    public Task<IReadOnlyList<BdsmUserMatch>> MatchAsync(string userId, IReadOnlyCollection<string> partnerIds, CancellationToken cancellationToken)
    {
        return MatchPairsAsync([.. partnerIds.Select(partnerId => new BdsmPair(userId, partnerId))], cancellationToken);
    }

    public async Task<IReadOnlyList<BdsmUserMatch>> MatchPairsAsync(IReadOnlyCollection<BdsmPair> pairs, CancellationToken cancellationToken)
    {
        if (pairs.Count is 0) return [];

        // One lookup for every person mentioned anywhere in the list, rather than one per pair.
        var everyone = Parse([.. pairs.SelectMany(pair => new[] { pair.UserId, pair.PartnerId })]);
        var latest = await repository.GetLatestForUsersAsync(everyone, cancellationToken);
        var byUser = latest.ToDictionary(entry => entry.UserId, entry => entry.ResultId);

        var runnable = pairs
            .Where(pair => TryParse(pair.UserId, out var user) && TryParse(pair.PartnerId, out var partner)
                           && byUser.ContainsKey(user) && byUser.ContainsKey(partner))
            .ToList();

        var matches = await RunAsync(runnable, async (pair, token) =>
        {
            var resultId = byUser[int.Parse(pair.UserId)];
            var partnerId = byUser[int.Parse(pair.PartnerId)];

            try
            {
                var match = await api.FetchMatchAsync(resultId, partnerId, cancellationToken: token);

                // Feeding the cache here saves the plain result endpoints a round trip later: a
                // match already carries both full results.
                cache.Set(resultId, match.Result);
                cache.Set(partnerId, match.Partner);

                return new BdsmUserMatch(pair.UserId, pair.PartnerId, match.Score, match.Result, match.Partner);
            }
            catch (BdsmTestApiException exception)
            {
                logger.LogWarning(exception, "Cannot match result {ResultId} against {PartnerId}", resultId, partnerId);
                return null;
            }
        }, cancellationToken);

        return matches;
    }

    // Which of the requested users the caller is allowed to see: themselves, and anyone following
    // their channel. Everything else is refused rather than silently dropped.
    public async Task<bool> MayAccessAsync(string callerId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        var strangers = userIds.Where(userId => !string.Equals(userId, callerId, StringComparison.Ordinal)).ToList();
        if (strangers.Count is 0) return true;

        var followers = await channels.GetFollowersAsync(callerId, cancellationToken);
        var following = followers.Select(follower => follower.UserId).ToHashSet(StringComparer.Ordinal);

        return strangers.All(following.Contains);
    }

    private async Task<IReadOnlyList<BdsmUserResult>> ResolveAsync(IReadOnlyList<BdsmResultRef> refs, CancellationToken cancellationToken)
    {
        return await RunAsync(refs, async (entry, token) =>
        {
            if (cache.Get(entry.ResultId) is { } cached) return new BdsmUserResult(entry.UserId, cached);

            try
            {
                var result = await api.FetchResultAsync(entry.ResultId, cancellationToken: token);
                cache.Set(entry.ResultId, result);

                return new BdsmUserResult(entry.UserId, result);
            }
            catch (BdsmTestApiException exception)
            {
                // A stored id BDSMTest.org no longer knows should cost one row, not the whole page.
                logger.LogWarning(exception, "Cannot fetch BDSM result {ResultId} of user {UserId}", entry.ResultId, entry.UserId);
                return null;
            }
        }, cancellationToken);
    }

    private static async Task<IReadOnlyList<TResult>> RunAsync<TSource, TResult>(
        IReadOnlyList<TSource> sources,
        Func<TSource, CancellationToken, Task<TResult?>> run,
        CancellationToken cancellationToken) where TResult : class
    {
        if (sources.Count is 0) return [];

        // Indexed rather than appended to, so the order the repository sorted them into survives
        // however the requests happen to finish.
        var results = new TResult?[sources.Count];

        await Parallel.ForAsync(0, sources.Count, new ParallelOptions
        {
            MaxDegreeOfParallelism = MaxParallelFetches,
            CancellationToken = cancellationToken
        }, async (index, token) => results[index] = await run(sources[index], token));

        return [.. results.OfType<TResult>()];
    }

    private static List<int> Parse(IReadOnlyCollection<string> userIds)
    {
        return [.. userIds.Select(userId => TryParse(userId, out var parsed) ? parsed : (int?) null).OfType<int>().Distinct()];
    }

    private static bool TryParse(string userId, out int parsed)
    {
        return int.TryParse(userId, out parsed);
    }
}
