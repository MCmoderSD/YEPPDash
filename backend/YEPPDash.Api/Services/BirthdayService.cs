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
    /// The birthdays of everyone following the given channel.
    /// </summary>
    /// <remarks>
    /// Every stored birthday is read first and then narrowed to the channel's followers, rather than
    /// the other way round. The Birthday table holds at most one row per user YEPPBot knows, while a
    /// follower list is unbounded — handing the database a few hundred thousand ids to filter on
    /// would be the worse half of the join to push down.
    /// </remarks>
    public async Task<IReadOnlyList<Birthday>> GetForFollowersAsync(
        string broadcasterId, CancellationToken cancellationToken)
    {
        var birthdays = await repository.GetAllAsync(cancellationToken);
        if (birthdays.Count is 0) return [];

        var followers = await channels.GetFollowersAsync(broadcasterId, cancellationToken);

        // Matched as ints because that is what the Birthday column is: a follower id too large to be
        // one cannot have a row there anyway, so failing to parse is the same answer as not matching.
        var following = new HashSet<int>();
        foreach (var follower in followers)
        {
            if (int.TryParse(follower.UserId, out var id)) following.Add(id);
        }

        var matched = birthdays.Where(birthday => following.Contains(birthday.UserId)).ToList();

        logger.LogInformation(
            "{Matched} of {Stored} stored birthdays belong to the {Followers} followers of channel {BroadcasterId}",
            matched.Count, birthdays.Count, followers.Count, broadcasterId);

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
