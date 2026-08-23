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

        // A channel the bot has never joined has no row, and that is not an error worth showing an
        // overlay: a timer nobody has set is a timer at zero.
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
        if (Math.Abs((long)seconds) > SubathonTimerLimits.MaxSeconds)
        {
            throw new InvalidSubathonTimerException(
                $"A timer cannot be moved by more than {SubathonTimerLimits.MaxSeconds} seconds at once.");
        }

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

    public Task<SubathonTimerState> SaveConfigAsync(
        string channelId, int startSeconds, CancellationToken cancellationToken)
    {
        return MutateAsync(
            channelId,
            $"given a {startSeconds}s start value",
            (id, token) => repository.SaveConfigAsync(id, Duration(startSeconds), token),
            cancellationToken);
    }

    public Task<SubathonTimerState> SaveStyleAsync(
        string channelId, string style, CancellationToken cancellationToken)
    {
        if (style.Length > SubathonTimerLimits.MaxStyleLength)
        {
            throw new InvalidSubathonTimerException(
                $"The overlay settings cannot be longer than {SubathonTimerLimits.MaxStyleLength} characters.");
        }

        return MutateAsync(
            channelId,
            "restyled",
            (id, token) => repository.SaveStyleAsync(id, style, token),
            cancellationToken);
    }

    /// <summary>
    /// Makes sure the row exists, runs the command, and tells every open overlay what came back.
    /// </summary>
    /// <remarks>
    /// Publishing happens here rather than in the controller, which is where the wheel does it. The
    /// timer has a second writer that this process never sees — the bot, straight into the table —
    /// and a watcher that turns those writes into the same events. Keeping both halves of that on the
    /// one shape means an overlay cannot tell a click from a chat command, which is the point.
    ///
    /// It also means a dashboard click does not wait on the watcher's next pass: this fires at once,
    /// and the watcher only ever picks up what the bot did. The occasional duplicate is harmless,
    /// because every message carries the whole state.
    /// </remarks>
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
            // The table is keyed on Channel, which is YEPPBot's, and the INSERT that would have made
            // room here is dropped rather than raised when that channel is not one the bot knows. So
            // reaching this means the bot has never been in it — and every command from here on would
            // quietly touch nothing, leaving a timer on screen that never moves and never explains why.
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
        if (seconds < 0)
        {
            throw new InvalidSubathonTimerException("A timer cannot be set to a negative duration.");
        }

        if (seconds > SubathonTimerLimits.MaxSeconds)
        {
            throw new InvalidSubathonTimerException(
                $"A timer cannot be set to more than {SubathonTimerLimits.MaxSeconds} seconds.");
        }

        return seconds;
    }

    private static SubathonTimerState Empty(int channelId)
    {
        return new SubathonTimerState(channelId, false, null, 0, 0, string.Empty, DateTime.UnixEpoch);
    }

    private static int ParseChannelId(string channelId)
    {
        if (!int.TryParse(channelId, out var id))
        {
            throw new ArgumentException($"'{channelId}' is not a numeric Twitch user ID.", nameof(channelId));
        }

        return id;
    }
}
