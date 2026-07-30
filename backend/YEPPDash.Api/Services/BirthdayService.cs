using MySqlConnector;
using YEPPDash.Api.Data;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

/// <summary>
/// Thrown when the user has no row in YEPPBot's User table, so a birthday cannot reference one.
/// </summary>
public sealed class UnknownBirthdayUserException(int userId, Exception inner)
    : Exception($"User {userId} is not known to YEPPBot.", inner);

public sealed class BirthdayService(
    BirthdayRepository repository,
    TwitchChannelService channels,
    ILogger<BirthdayService> logger)
{
    public Task<Birthday?> GetAsync(string userId, CancellationToken cancellationToken)
    {
        return repository.GetAsync(ParseUserId(userId), cancellationToken);
    }

    /// <summary>
    /// The birthdays of everyone following the given channel, plus the channel owner's own.
    /// </summary>
    /// <remarks>
    /// Every stored birthday is read first and then checked one by one against Twitch, rather than
    /// pulling the channel's whole follower list and intersecting it. The Birthday table holds at most
    /// one row per user YEPPBot knows, and there will almost always be far fewer of those than a
    /// channel has followers — walking a follower list that can run into the hundreds of thousands to
    /// answer a question about a handful of stored rows would be the more expensive way round.
    /// </remarks>
    public async Task<IReadOnlyList<Birthday>> GetForFollowersAsync(
        string broadcasterId, CancellationToken cancellationToken)
    {
        var birthdays = await repository.GetAllAsync(cancellationToken);
        if (birthdays.Count is 0) return [];

        var matched = new List<Birthday>(birthdays.Count);

        // Sequential rather than in parallel: Twitch bills every call against the same rate limit, and
        // a wide fan-out here only trades one slow request for a throttled one — the same tradeoff
        // TwitchChannelService makes for its own batched membership checks.
        foreach (var birthday in birthdays)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var userId = birthday.UserId.ToString();

            // Twitch has no notion of following your own channel, so the owner is taken on their id
            // alone rather than a follow check that could never come back true.
            var isOwner = string.Equals(userId, broadcasterId, StringComparison.Ordinal);
            if (isOwner || await channels.GetFollowerAsync(broadcasterId, userId, cancellationToken) is not null)
            {
                matched.Add(birthday);
            }
        }

        logger.LogInformation(
            "{Matched} of {Stored} stored birthdays belong to channel {BroadcasterId} or its followers",
            matched.Count, birthdays.Count, broadcasterId);

        return matched;
    }

    /// <returns>The stored birthday, or <c>null</c> when the user already has one.</returns>
    /// <exception cref="UnknownBirthdayUserException">YEPPBot does not know the user.</exception>
    public async Task<Birthday?> AddAsync(
        string userId, int day, int month, int year, CancellationToken cancellationToken)
    {
        var birthday = new Birthday(ParseUserId(userId), day, month, year);

        try
        {
            if (!await repository.InsertAsync(birthday, cancellationToken)) return null;
        }
        catch (MySqlException exception)
            when (exception.ErrorCode is MySqlErrorCode.NoReferencedRow or MySqlErrorCode.NoReferencedRow2)
        {
            throw new UnknownBirthdayUserException(birthday.UserId, exception);
        }

        logger.LogInformation("Stored the birthday of user {UserId}", birthday.UserId);
        return birthday;
    }

    /// <returns>The updated birthday, or <c>null</c> when the user has none to update.</returns>
    public async Task<Birthday?> UpdateAsync(
        string userId, int day, int month, int year, CancellationToken cancellationToken)
    {
        var birthday = new Birthday(ParseUserId(userId), day, month, year);

        if (!await repository.UpdateAsync(birthday, cancellationToken)) return null;

        logger.LogInformation("Updated the birthday of user {UserId}", birthday.UserId);
        return birthday;
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
