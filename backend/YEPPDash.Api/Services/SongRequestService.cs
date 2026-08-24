using YEPPDash.Api.Data.Spotify;
using YEPPDash.Api.Exceptions.Spotify;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Spotify;

namespace YEPPDash.Api.Services;

/// <summary>
/// Everything that stands between a line of chat and Spotify's queue. The guards live here rather
/// than in the bot for one reason: the dashboard reaches the same queue by a different route, and a
/// limit the dashboard can walk around is not a limit.
/// </summary>
public sealed class SongRequestService(
    SpotifyRepository repository,
    ISpotifyPlaybackService playback,
    TwitchChannelService channels,
    ILogger<SongRequestService> logger)
{
    public async Task<SpotifyTrack> RequestAsync(
        int channelId, SongRequestInput request, SongRequestSource source, CancellationToken cancellationToken)
    {
        var input = request.Input.Trim();

        if (input.Length is 0 || input.Length > SpotifyLimits.MaxRequestInputLength)
        {
            throw new SongRequestRejectedException(SongRequestReason.NotFound);
        }

        var settings = await repository.GetSettingsAsync(channelId, cancellationToken);

        // The broadcaster set these to hold their chat back, not themselves. Adding a track from
        // their own dashboard skips them; the blocklist and the duplicate check below still apply,
        // because those say "not this track" rather than "not this often".
        if (source is SongRequestSource.Chat)
        {
            await CheckChatGuardsAsync(channelId, settings, request.TwitchUserId, cancellationToken);
        }

        var track = await ResolveAsync(channelId, input, cancellationToken);

        if (source is SongRequestSource.Chat && track.DurationMs > settings.MaxDurationMs)
        {
            throw new SongRequestRejectedException(SongRequestReason.TooLong);
        }

        await CheckBlocklistAsync(channelId, track, cancellationToken);
        await CheckDuplicateAsync(channelId, track, cancellationToken);

        await playback.AddToQueueAsync(channelId, track.Uri, cancellationToken);

        await repository.LogRequestAsync(
            channelId, track, request.TwitchUserId, request.TwitchUserName, source, cancellationToken);

        logger.LogInformation(
            "{User} queued \"{Track}\" in channel {ChannelId} from {Source}",
            request.TwitchUserName, track.Name, channelId, source);

        return track;
    }

    /// <summary>
    /// Ordered so the cheap answers come first. The live check is last of the three on purpose: it
    /// is the only one that costs a call to Twitch, and by then the per-user cooldown has already
    /// capped how often it can happen.
    /// </summary>
    private async Task CheckChatGuardsAsync(
        int channelId, SpotifySettings settings, string twitchUserId, CancellationToken cancellationToken)
    {
        if (!settings.RequestsEnabled) throw new SongRequestRejectedException(SongRequestReason.Disabled);

        if (settings.CooldownSeconds > 0)
        {
            var last = await repository.GetLastRequestAtAsync(channelId, twitchUserId, cancellationToken);

            if (last is not null)
            {
                var waited = DateTime.UtcNow - last.Value;
                var remaining = TimeSpan.FromSeconds(settings.CooldownSeconds) - waited;

                if (remaining > TimeSpan.Zero)
                {
                    throw new SongRequestRejectedException(
                        SongRequestReason.Cooldown, (int)Math.Ceiling(remaining.TotalSeconds));
                }
            }
        }

        if (!settings.RequestsLiveOnly) return;

        try
        {
            if (!await channels.IsLiveAsync(channelId.ToString(), cancellationToken))
            {
                throw new SongRequestRejectedException(SongRequestReason.NotLive);
            }
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            // Twitch being unreachable is not the requester's fault, and refusing every request
            // until it comes back would turn one outage into two. Let it through and say so.
            logger.LogWarning(
                exception, "Could not check whether channel {ChannelId} is live, letting the request through", channelId);
        }
    }

    /// <summary>
    /// A link resolves to exactly one track; anything else is a search, and the first hit wins.
    /// Chat never learns which of the two happened, which is why the bot can forward raw text.
    /// </summary>
    private async Task<SpotifyTrack> ResolveAsync(int channelId, string input, CancellationToken cancellationToken)
    {
        var reference = SpotifyUriResolver.Resolve(input);

        if (reference is null)
        {
            var matches = await playback.SearchAsync(channelId, input, 1, cancellationToken);

            return matches.FirstOrDefault() ?? throw new SongRequestRejectedException(SongRequestReason.NotFound);
        }

        // Spotify's queue takes podcast episodes perfectly happily, and an episode link is one
        // character different from a track link. Nobody wants an hour of talk in a music queue.
        if (reference.Kind is SpotifyItemKind.Episode)
        {
            throw new SongRequestRejectedException(SongRequestReason.NotATrack);
        }

        return await playback.GetTrackAsync(channelId, reference.Id, cancellationToken)
            ?? throw new SongRequestRejectedException(SongRequestReason.NotFound);
    }

    private async Task CheckBlocklistAsync(int channelId, SpotifyTrack track, CancellationToken cancellationToken)
    {
        var blocklist = await repository.GetBlocklistAsync(channelId, cancellationToken);
        if (blocklist.Count is 0) return;

        var blocked = blocklist.Any(entry => entry.EntryType switch
        {
            SpotifyBlocklistType.Track => string.Equals(entry.EntryId, track.Id, StringComparison.Ordinal),
            SpotifyBlocklistType.Artist => track.ArtistIds.Contains(entry.EntryId, StringComparer.Ordinal),
            _ => false
        });

        if (blocked) throw new SongRequestRejectedException(SongRequestReason.Blocked);
    }

    /// <summary>
    /// Asks Spotify rather than the request log, because the queue is Spotify's and the log only
    /// knows about requests that came through here. It also folds in the "is anything playing at
    /// all" check: the queue call answers both, and a track added with no active device goes
    /// nowhere while reporting success.
    /// </summary>
    private async Task CheckDuplicateAsync(int channelId, SpotifyTrack track, CancellationToken cancellationToken)
    {
        var state = await playback.GetPlaybackAsync(channelId, cancellationToken);

        if (state.Track is null && state.Device is null) throw new NoActiveDeviceException();

        if (string.Equals(state.Track?.Id, track.Id, StringComparison.Ordinal))
        {
            throw new SongRequestRejectedException(SongRequestReason.Duplicate);
        }

        var queue = await playback.GetQueueAsync(channelId, cancellationToken);

        if (queue.Any(queued => string.Equals(queued.Id, track.Id, StringComparison.Ordinal)))
        {
            throw new SongRequestRejectedException(SongRequestReason.Duplicate);
        }
    }
}
