using System.Globalization;
using MySqlConnector;
using YEPPDash.Api.Data.Birthday;
using YEPPDash.Api.Exceptions.Birthday;
using YEPPDash.Api.Helpers;
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

    public async Task<int> CountForFollowersAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        return (await MatchFollowerBirthdaysAsync(broadcasterId, cancellationToken)).Count;
    }

    public async Task<IReadOnlyList<FollowerBirthdayResponse>> GetForFollowersAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var matched = await MatchFollowerBirthdaysAsync(broadcasterId, cancellationToken);
        if (matched.Count is 0) return [];

        var userIds = matched.Select(birthday => birthday.UserId.ToString(CultureInfo.InvariantCulture)).ToArray();
        var profiles = await channels.GetUserProfilesAsync(broadcasterId, userIds, [], cancellationToken);
        var byId = profiles.ToDictionary(user => user.Id, StringComparer.Ordinal);

        return matched
            .Select(birthday => FollowerBirthdayResponse.From(birthday, byId.GetValueOrDefault(birthday.UserId.ToString(CultureInfo.InvariantCulture))))
            .ToList();
    }

    private async Task<IReadOnlyList<Birthday>> MatchFollowerBirthdaysAsync(string broadcasterId, CancellationToken cancellationToken)
    {
        var birthdays = await repository.GetAllAsync(cancellationToken);
        if (birthdays.Count is 0) return [];

        var followers = await channels.GetFollowersAsync(broadcasterId, cancellationToken);

        var following = new HashSet<int>();

        if (int.TryParse(broadcasterId, out var owner)) following.Add(owner);

        foreach (var follower in followers)
        {
            if (int.TryParse(follower.UserId, out var id)) following.Add(id);
        }

        var matched = birthdays.Where(birthday => following.Contains(birthday.UserId)).ToList();

        logger.LogDebug(
            "{Matched} of {Stored} stored birthdays belong to channel {BroadcasterId} or its {Followers} followers",
            matched.Count, birthdays.Count, LogSafe.OneLine(broadcasterId), followers.Count);

        return matched;
    }

    public async Task<Birthday?> AddAsync(string userId, int day, int month, int year, CancellationToken cancellationToken)
    {
        var birthday = new Birthday(int.Parse(userId), day, month, year);

        try
        {
            if (!await repository.InsertAsync(birthday, cancellationToken)) return null;
        }
        catch (MySqlException exception) when (exception.ErrorCode is MySqlErrorCode.NoReferencedRow or MySqlErrorCode.NoReferencedRow2)
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