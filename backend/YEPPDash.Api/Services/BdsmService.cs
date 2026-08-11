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

    // Just how well everyone gets on, without the results behind it. A cached score then costs
    // nothing at all: the two results are what would otherwise have to be fetched.
    public async Task<IReadOnlyList<BdsmMatchScore>> ScoreAsync(string userId, IReadOnlyCollection<string> partnerIds, CancellationToken cancellationToken)
    {
        var (runnable, scored) = await PrepareAsync([.. partnerIds.Select(partnerId => new BdsmPair(userId, partnerId))], cancellationToken);

        return await RunAsync(runnable, async (entry, token) =>
        {
            if (scored.TryGetValue((entry.ResultId, entry.PartnerId), out var score))
            {
                return new BdsmMatchScore(entry.Pair.UserId, entry.Pair.PartnerId, Percent(score));
            }

            var match = await MatchedAsync(entry, token);
            return match is null ? null : new BdsmMatchScore(entry.Pair.UserId, entry.Pair.PartnerId, match.Score);
        }, cancellationToken);
    }

    public async Task<IReadOnlyList<BdsmUserMatch>> MatchPairsAsync(IReadOnlyCollection<BdsmPair> pairs, CancellationToken cancellationToken)
    {
        var (runnable, scored) = await PrepareAsync(pairs, cancellationToken);

        return await RunAsync(runnable, async (entry, token) =>
        {
            // A score YEPPBot already worked out spares the match request; the two results behind
            // it are usually in memory by then, which spares the other two.
            if (scored.TryGetValue((entry.ResultId, entry.PartnerId), out var score))
            {
                var result = await ResultAsync(entry.ResultId, token);
                var partner = await ResultAsync(entry.PartnerId, token);

                if (result is not null && partner is not null)
                {
                    return new BdsmUserMatch(entry.Pair.UserId, entry.Pair.PartnerId, Percent(score), result, partner);
                }

                return null;
            }

            var match = await MatchedAsync(entry, token);

            return match is null
                ? null
                : new BdsmUserMatch(entry.Pair.UserId, entry.Pair.PartnerId, match.Score, match.Result, match.Partner);
        }, cancellationToken);
    }

    private async Task<MatchResult?> MatchedAsync(Runnable entry, CancellationToken cancellationToken)
    {
        try
        {
            var match = await api.FetchMatchAsync(entry.ResultId, entry.PartnerId, cancellationToken: cancellationToken);

            // Feeding the cache here saves the plain result endpoints a round trip later: a match
            // already carries both full results.
            cache.Set(entry.ResultId, match.Result);
            cache.Set(entry.PartnerId, match.Partner);

            return match;
        }
        catch (BdsmTestApiException exception)
        {
            logger.LogWarning(exception, "Cannot match result {ResultId} against {PartnerId}", entry.ResultId, entry.PartnerId);
            return null;
        }
    }

    // Which pairs can actually be answered, and which of them YEPPBot has already scored.
    private async Task<(IReadOnlyList<Runnable> Runnable, Dictionary<(string, string), double> Scored)> PrepareAsync(
        IReadOnlyCollection<BdsmPair> pairs, CancellationToken cancellationToken)
    {
        if (pairs.Count is 0) return ([], []);

        // One lookup for every person mentioned anywhere in the list, rather than one per pair.
        var everyone = Parse([.. pairs.SelectMany(pair => new[] { pair.UserId, pair.PartnerId })]);
        var latest = await repository.GetLatestForUsersAsync(everyone, cancellationToken);
        var byUser = latest.ToDictionary(entry => entry.UserId, entry => entry.ResultId);

        var runnable = pairs
            .Where(pair => TryParse(pair.UserId, out var user) && TryParse(pair.PartnerId, out var partner)
                           && byUser.ContainsKey(user) && byUser.ContainsKey(partner))
            .Select(pair => new Runnable(pair, byUser[int.Parse(pair.UserId)], byUser[int.Parse(pair.PartnerId)]))
            .ToList();

        return (runnable, await ScoredAsync(runnable, cancellationToken));
    }

    private async Task<Dictionary<(string, string), double>> ScoredAsync(
        IReadOnlyList<Runnable> runnable, CancellationToken cancellationToken)
    {
        if (runnable.Count is 0) return [];

        var cached = await repository.GetCachedMatchesAsync(
            [.. runnable.Select(entry => entry.ResultId).Distinct(StringComparer.Ordinal)],
            [.. runnable.Select(entry => entry.PartnerId).Distinct(StringComparer.Ordinal)],
            cancellationToken);

        // The query answers by two id lists, so it can return pairs nobody asked about; only the
        // ones actually on the list are kept.
        var wanted = runnable.Select(entry => (entry.ResultId, entry.PartnerId)).ToHashSet<(string, string)>();

        return cached
            .Where(entry => wanted.Contains((entry.ResultId, entry.PartnerId)))
            .DistinctBy(entry => (entry.ResultId, entry.PartnerId))
            .ToDictionary(entry => (entry.ResultId, entry.PartnerId), entry => entry.Score);
    }

    // MatchCache keeps a fraction, BDSMTest.org and the package both report whole percent.
    private static int Percent(double score)
    {
        return (int) Math.Round(score * 100, MidpointRounding.AwayFromZero);
    }

    private sealed record Runnable(BdsmPair Pair, string ResultId, string PartnerId);

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
            var result = await ResultAsync(entry.ResultId, token);
            return result is null ? null : new BdsmUserResult(entry.UserId, result);
        }, cancellationToken);
    }

    private async Task<TestResult?> ResultAsync(string resultId, CancellationToken cancellationToken)
    {
        if (cache.Get(resultId) is { } cached) return cached;

        try
        {
            var result = await api.FetchResultAsync(resultId, cancellationToken: cancellationToken);
            cache.Set(resultId, result);

            return result;
        }
        catch (BdsmTestApiException exception)
        {
            // A stored id BDSMTest.org no longer knows should cost one row, not the whole page.
            logger.LogWarning(exception, "Cannot fetch BDSM result {ResultId}", resultId);
            return null;
        }
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
