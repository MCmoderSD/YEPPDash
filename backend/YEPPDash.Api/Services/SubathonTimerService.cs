using YEPPDash.Api.Data.SubathonTimer;
using YEPPDash.Api.Exceptions.SubathonTimer;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

public sealed class SubathonTimerService(
    SubathonTimerRepository repository,
    SubathonTimerHub hub,
    ILogger<SubathonTimerService> logger)
{
    public async Task<SubathonTimerState> GetAsync(string channelId, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);

        return await repository.GetAsync(id, cancellationToken) ?? Empty(id);
    }

    public Task<SubathonTimerState> StartAsync(string channelId, CancellationToken cancellationToken)
    {
        return MutateAsync(channelId, "started", repository.StartAsync, cancellationToken);
    }

    public Task<SubathonTimerState> PauseAsync(string channelId, CancellationToken cancellationToken)
    {
        return MutateAsync(channelId, "paused", repository.PauseAsync, cancellationToken);
    }

    public Task<SubathonTimerState> ResetAsync(string channelId, CancellationToken cancellationToken)
    {
        return MutateAsync(channelId, "reset", repository.ResetAsync, cancellationToken);
    }

    public Task<SubathonTimerState> AdjustAsync(string channelId, int seconds, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            $"moved by {seconds}s",
            (id, token) => repository.AdjustAsync(id, seconds, token),
            cancellationToken);
    }

    public Task<SubathonTimerState> SetAsync(string channelId, int seconds, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            $"set to {seconds}s",
            (id, token) => repository.SetAsync(id, Duration(seconds), token),
            cancellationToken);
    }

    public Task<SubathonTimerState> SaveConfigAsync(string channelId, int startSeconds, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            $"given a {startSeconds}s start value",
            (id, token) => repository.SaveConfigAsync(id, Duration(startSeconds), token),
            cancellationToken);
    }

    public Task<SubathonTimerState> SaveStyleAsync(string channelId, string style, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            "restyled",
            (id, token) => repository.SaveStyleAsync(id, style, token),
            cancellationToken);
    }

    private async Task<SubathonTimerState> MutateAsync(
        string channelId,
        string what,
        Func<int, CancellationToken, Task<SubathonTimerState?>> command,
        CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);

        await repository.EnsureAsync(id, cancellationToken);

        var state = await command(id, cancellationToken);

        if (state is null)
        {

            logger.LogWarning("Channel {ChannelId} has no timer row — YEPPBot has never joined it", id);

            throw new InvalidSubathonTimerException(
                "YEPPBot has to be in your channel before the timer can run. Add it on the dashboard, then try again.");
        }

        hub.Publish(id, SubathonTimerEvents.Serialize(state, DateTime.UtcNow));
        logger.LogInformation("The subathon timer of channel {ChannelId} was {Change}", id, what);

        return state;
    }

    private static int Duration(int seconds)
    {
        return seconds < 0 ? throw new InvalidSubathonTimerException("A timer cannot be set to a negative duration.") : seconds;
    }

    private static SubathonTimerState Empty(int channelId)
    {
        return new SubathonTimerState(channelId, false, null, 0, 0, string.Empty, DateTime.UnixEpoch);
    }

    private static int ParseChannelId(string channelId)
    {
        return !int.TryParse(channelId, out var id) ? throw new ArgumentException($"'{channelId}' is not a numeric Twitch user ID.", nameof(channelId)) : id;
    }
}