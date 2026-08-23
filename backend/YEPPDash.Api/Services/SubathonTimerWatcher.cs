using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

/// <summary>
/// Turns what the bot writes into what an overlay sees.
/// </summary>
/// <remarks>
/// The dashboard and YEPPBot share one table and nothing else — the bot updates the row from chat and
/// has no way to tell this process about it. So this goes and looks, once a second, and publishes
/// whatever changed. Everything the dashboard itself does is already published by
/// <see cref="SubathonTimerService"/> the moment it happens, so in practice this is here for the bot.
/// </remarks>
public sealed class SubathonTimerWatcher(
    SubathonTimerHub hub,
    IServiceScopeFactory scopeFactory,
    ILogger<SubathonTimerWatcher> logger
) : BackgroundService {

    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(1);

    // The updatedAt each channel was last published at. MariaDB maintains that column itself through
    // ON UPDATE, so a row whose value has not moved is a row nothing has happened to.
    private readonly Dictionary<int, DateTime> _published = [];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var ticks = new PeriodicTimer(Interval);

        while (await ticks.WaitForNextTickAsync(stoppingToken))
        {
            // Nothing to do while nobody is watching: with no overlay open the query is skipped
            // altogether rather than prodding the database once a second around the clock.
            var watched = hub.WatchedChannels();

            if (watched.Count is 0)
            {
                _published.Clear();
                continue;
            }

            try
            {
                await PublishChangesAsync(watched, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                // One bad pass is not worth ending the loop over — the next tick tries again, and
                // until then the overlays keep counting down from what they already have.
                logger.LogWarning(exception, "Could not check the subathon timers for changes");
            }
        }
    }

    private async Task PublishChangesAsync(IReadOnlyCollection<int> watched, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var timers = scope.ServiceProvider.GetRequiredService<SubathonTimerRepository>();

        var states = await timers.GetManyAsync(watched, cancellationToken);
        var serverNow = DateTime.UtcNow;

        foreach (var state in states)
        {
            // The database's own value is compared against itself, never against our clock. The bot,
            // this process and MariaDB all keep their own time, and asking for "anything newer than a
            // second ago" would drop changes or repeat them depending on which way the drift ran.
            if (_published.TryGetValue(state.ChannelId, out var published) && published == state.UpdatedAt) continue;

            _published[state.ChannelId] = state.UpdatedAt;
            hub.Publish(state.ChannelId, SubathonTimerEvents.Serialize(state, serverNow));
        }

        // Channels nobody is watching any more would otherwise sit here for the life of the process.
        foreach (var channelId in _published.Keys.Where(id => !watched.Contains(id)).ToArray())
        {
            _published.Remove(channelId);
        }
    }
}
