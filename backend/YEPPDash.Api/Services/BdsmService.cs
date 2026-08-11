using MCmoderSD.BdsmTestApi.Core;
using MCmoderSD.BdsmTestApi.Exceptions;
using YEPPDash.Api.Data.Bdsm;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class BdsmService(
    BdsmRepository repository,
    BdsmTestApi api,
    TwitchChannelService channels,
    ILogger<BdsmService> logger
) {
    private const int MaxParallelFetches = 4;

    public async Task<IReadOnlyList<BdsmResult>> GetForUserAsync(string userId, CancellationToken cancellationToken)
    {
        if (!TryParse(userId, out var parsed)) return [];

        return await repository.GetForUserAsync(parsed, cancellationToken);
    }

    public async Task<IReadOnlyList<BdsmResult>> GetForUsersAsync(IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        var parsed = Parse(userIds);
        if (parsed.Count is 0) return [];

        return await repository.GetLatestForUsersAsync(parsed, cancellationToken);
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

    public async Task<IReadOnlyList<BdsmMatchScore>> ScoreAsync(string userId, IReadOnlyCollection<string> partnerIds, CancellationToken cancellationToken)
    {
        var scored = await ScoredPairsAsync([.. partnerIds.Select(partnerId => new BdsmPair(userId, partnerId))], cancellationToken);

        return [.. scored.Select(entry => new BdsmMatchScore(entry.Pair.UserId, entry.Pair.PartnerId, entry.Score))];
    }

    public async Task<IReadOnlyList<BdsmUserMatch>> MatchPairsAsync(IReadOnlyCollection<BdsmPair> pairs, CancellationToken cancellationToken)
    {
        var scored = await ScoredPairsAsync(pairs, cancellationToken);

        return [.. scored.Select(entry => new BdsmUserMatch(entry.Pair.UserId, entry.Pair.PartnerId, entry.Score, entry.Result, entry.Partner))];
    }

    public async Task<bool> MayAccessAsync(string callerId, IReadOnlyCollection<string> userIds, CancellationToken cancellationToken)
    {
        var strangers = userIds.Where(userId => !string.Equals(userId, callerId, StringComparison.Ordinal)).ToList();
        if (strangers.Count is 0) return true;

        var followers = await channels.GetFollowersAsync(callerId, cancellationToken);
        var following = followers.Select(follower => follower.UserId).ToHashSet(StringComparer.Ordinal);

        return strangers.All(following.Contains);
    }

    private async Task<IReadOnlyList<Scored>> ScoredPairsAsync(IReadOnlyCollection<BdsmPair> pairs, CancellationToken cancellationToken)
    {
        if (pairs.Count is 0) return [];

        var everyone = Parse([.. pairs.SelectMany(pair => new[] { pair.UserId, pair.PartnerId })]);
        var latest = await repository.GetLatestForUsersAsync(everyone, cancellationToken);
        var byUser = latest.ToDictionary(result => result.UserId);

        var runnable = pairs
            .Where(pair => TryParse(pair.UserId, out var user) && TryParse(pair.PartnerId, out var partner) && byUser.ContainsKey(user) && byUser.ContainsKey(partner))
            .Select(pair => new Runnable(pair, byUser[int.Parse(pair.UserId)], byUser[int.Parse(pair.PartnerId)]))
            .ToList();

        var cached = await CachedAsync(runnable, cancellationToken);

        return await RunAsync(runnable, async (entry, token) =>
        {
            if (cached.TryGetValue((entry.Result.Id, entry.Partner.Id), out var score))
            {
                return new Scored(entry.Pair, Percent(score), entry.Result, entry.Partner);
            }

            var fetched = await FetchScoreAsync(entry, token);

            return fetched is null ? null : new Scored(entry.Pair, fetched.Value, entry.Result, entry.Partner);
        }, cancellationToken);
    }

    private async Task<Dictionary<(string, string), double>> CachedAsync(IReadOnlyList<Runnable> runnable, CancellationToken cancellationToken)
    {
        if (runnable.Count is 0) return [];

        var cached = await repository.GetCachedMatchesAsync(
            [.. runnable.Select(entry => entry.Result.Id).Distinct(StringComparer.Ordinal)],
            [.. runnable.Select(entry => entry.Partner.Id).Distinct(StringComparer.Ordinal)],
            cancellationToken);

        var wanted = runnable.Select(entry => (entry.Result.Id, entry.Partner.Id)).ToHashSet();

        return cached
            .Where(entry => wanted.Contains((entry.ResultId, entry.PartnerId)))
            .DistinctBy(entry => (entry.ResultId, entry.PartnerId))
            .ToDictionary(entry => (entry.ResultId, entry.PartnerId), entry => entry.Score);
    }

    private async Task<int?> FetchScoreAsync(Runnable entry, CancellationToken cancellationToken)
    {
        try
        {
            var match = await api.FetchMatchAsync(entry.Result.Id, entry.Partner.Id, cancellationToken: cancellationToken);
            return match.Score;
        }
        catch (BdsmTestApiException exception)
        {
            logger.LogWarning(exception, "Cannot match result {ResultId} against {PartnerId}", entry.Result.Id, entry.Partner.Id);
            return null;
        }
    }

    private static async Task<IReadOnlyList<TResult>> RunAsync<TSource, TResult>(
        IReadOnlyList<TSource> sources,
        Func<TSource, CancellationToken, Task<TResult?>> run,
        CancellationToken cancellationToken) where TResult : class
    {
        if (sources.Count is 0) return [];

        var results = new TResult?[sources.Count];

        await Parallel.ForAsync(0, sources.Count, new ParallelOptions
        {
            MaxDegreeOfParallelism = MaxParallelFetches,
            CancellationToken = cancellationToken
        }, async (index, token) => results[index] = await run(sources[index], token));

        return [.. results.OfType<TResult>()];
    }

    private static int Percent(double score)
    {
        return (int) Math.Round(score * 100, MidpointRounding.AwayFromZero);
    }

    private static List<int> Parse(IReadOnlyCollection<string> userIds)
    {
        return [.. userIds.Select(userId => TryParse(userId, out var parsed) ? parsed : (int?) null).OfType<int>().Distinct()];
    }

    private static bool TryParse(string userId, out int parsed)
    {
        return int.TryParse(userId, out parsed);
    }

    private sealed record Runnable(BdsmPair Pair, BdsmResult Result, BdsmResult Partner);

    private sealed record Scored(BdsmPair Pair, int Score, BdsmResult Result, BdsmResult Partner);
}