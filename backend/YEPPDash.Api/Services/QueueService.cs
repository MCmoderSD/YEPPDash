using YEPPDash.Api.Data.Queue;
using YEPPDash.Api.Exceptions.Queue;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Services;

public sealed class QueueService(
    QueueRepository repository,
    QueueHub hub,
    ILogger<QueueService> logger)
{
    public async Task<QueueState> GetAsync(string channelId, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);

        return await repository.GetAsync(id, cancellationToken) ?? Empty(id);
    }

    public Task<QueueState> OpenAsync(string channelId, CancellationToken cancellationToken)
    {
        return MutateAsync(channelId, "opened", repository.OpenAsync, cancellationToken);
    }

    public Task<QueueState> CloseAsync(string channelId, CancellationToken cancellationToken)
    {
        return MutateAsync(channelId, "closed", repository.CloseAsync, cancellationToken);
    }

    public Task<QueueState> ClearAsync(string channelId, CancellationToken cancellationToken)
    {
        return MutateAsync(channelId, "cleared", repository.ClearAsync, cancellationToken);
    }

    public Task<QueueState> NextAsync(string channelId, CancellationToken cancellationToken)
    {
        return MutateAsync(channelId, "moved on to the next entry", repository.NextAsync, cancellationToken);
    }

    public Task<QueueState> RemoveAsync(string channelId, string userId, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            $"asked to drop {Entry(userId)}",
            (id, token) => repository.RemoveAsync(id, userId, token),
            cancellationToken);
    }

    public Task<QueueState> MoveAsync(string channelId, string userId, int position, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            $"asked to put {Entry(userId)} in place {position}",
            (id, token) => repository.MoveAsync(id, userId, position - 1, token),
            cancellationToken);
    }

    public Task<QueueState> SaveRequirementAsync(string channelId, QueueRequirement requirement, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            $"restricted to {requirement}",
            (id, token) => repository.SaveRequirementAsync(id, requirement, token),
            cancellationToken);
    }

    private async Task<QueueState> MutateAsync(
        string channelId,
        string what,
        Func<int, CancellationToken, Task<QueueState?>> command,
        CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);

        await repository.EnsureAsync(id, cancellationToken);

        var state = await command(id, cancellationToken);

        if (state is null)
        {

            logger.LogWarning("Channel {ChannelId} has no queue row — YEPPBot has never joined it", id);

            throw new InvalidQueueException(
                "YEPPBot has to be in your channel before the queue can run. Add it on the dashboard, then try again.");
        }

        hub.Publish(id, QueueEvents.Serialize(state));
        logger.LogInformation("The queue of the channel {ChannelId} was {Change}", id, what);

        return state;
    }

    private static string Entry(string userId)
    {
        return int.TryParse(userId, out var id) ? id.ToString() : "an entry that is not a user ID";
    }

    private static QueueState Empty(int channelId)
    {
        return new QueueState(channelId, false, QueueRequirement.Everyone, [], DateTime.UnixEpoch);
    }

    private static int ParseChannelId(string channelId)
    {
        return !int.TryParse(channelId, out var id) ? throw new ArgumentException($"'{channelId}' is not a numeric Twitch user ID.", nameof(channelId)) : id;
    }
}