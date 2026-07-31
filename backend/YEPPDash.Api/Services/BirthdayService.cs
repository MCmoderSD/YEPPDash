using MySqlConnector;
using YEPPDash.Api.Data.Birthday;
using YEPPDash.Api.Exceptions.Birthday;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class BirthdayService(
    BirthdayRepository repository,
    TwitchChannelService channels,
    ILogger<BirthdayService> logger)
{
    public Task<Birthday?> GetAsync(string userId, CancellationToken cancellationToken)
    {
        return repository.GetAsync(int.Parse(userId), cancellationToken);
    }

    public async Task<IReadOnlyList<Birthday>> GetForFollowersAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var birthdays = await repository.GetAllAsync(cancellationToken);
        if (birthdays.Count is 0) return [];

        var followers = await channels.GetFollowersAsync(broadcasterId, cancellationToken);


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

    public async Task<Birthday?> AddAsync(string userId, int day, int month, int year, CancellationToken cancellationToken)
    {
        var birthday = new Birthday(int.Parse(userId), day, month, year);

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

    public async Task<Birthday?> UpdateAsync(string userId, int day, int month, int year, CancellationToken cancellationToken)
    {
        var birthday = new Birthday(int.Parse(userId), day, month, year);

        if (!await repository.UpdateAsync(birthday, cancellationToken)) return null;

        logger.LogInformation("Updated the birthday of user {UserId}", birthday.UserId);
        return birthday;
    }
}