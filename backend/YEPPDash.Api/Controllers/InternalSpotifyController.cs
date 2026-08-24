using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Auth;
using YEPPDash.Api.Data.Spotify;
using YEPPDash.Api.Exceptions.Spotify;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

/// <summary>
/// What YEPPBot calls. It exists so the bot can stay entirely free of Spotify: no client id, no
/// tokens, no link parsing, no guards — it posts the raw text somebody typed and turns whatever
/// comes back into a sentence.
/// <para>
/// Authenticated with a service token rather than a Twitch session, because the bot is not a user.
/// Role checks stay on the bot's side: it already knows who is a moderator, and this API has no way
/// to find out.
/// </para>
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("internal/spotify")]
public sealed class InternalSpotifyController(
    ServiceToken serviceToken,
    SongRequestService requests,
    ISpotifyPlaybackService playback,
    SpotifyQueueProjection queues,
    SpotifyPlaybackHub hub,
    ILogger<InternalSpotifyController> logger) : ControllerBase
{
    [HttpGet("{channelId:int}/state")]
    public Task<IActionResult> State(int channelId, CancellationToken cancellationToken)
    {
        return RunAsync(async () =>
        {
            var state = await playback.GetPlaybackAsync(channelId, cancellationToken);

            return Ok(SpotifyBotStateResponse.From(state));
        });
    }

    [HttpGet("{channelId:int}/queue")]
    public Task<IActionResult> Queue(int channelId, [FromQuery] int? limit, CancellationToken cancellationToken)
    {
        return RunAsync(async () =>
        {
            var entries = await queues.GetAsync(
                channelId,
                Math.Clamp(limit ?? SpotifyLimits.QueueLength, 1, SpotifyLimits.QueueLength),
                cancellationToken);

            return Ok(entries.Select(SpotifyBotQueueEntryResponse.From));
        });
    }

    /// <summary>
    /// Takes raw text — a link, a URI, an id or something to search for. Everything that turns it
    /// into a track, and every reason it might not become one, is on this side of the wire.
    /// </summary>
    [HttpPost("{channelId:int}/request")]
    public Task<IActionResult> Enqueue(
        int channelId, [FromBody] SongRequestInput request, CancellationToken cancellationToken)
    {
        return RunAsync(async () =>
        {
            if (string.IsNullOrWhiteSpace(request.TwitchUserId))
            {
                return BadRequest("A song request needs the Twitch user it came from.");
            }

            var track = await requests.RequestAsync(channelId, request, SongRequestSource.Chat, cancellationToken);

            await RepublishAsync(channelId, cancellationToken);

            return Ok(SongRequestAcceptedResponse.From(track));
        });
    }

    [HttpPost("{channelId:int}/next")]
    public Task<IActionResult> Next(int channelId, CancellationToken cancellationToken)
    {
        return CommandAsync(channelId, () => playback.SkipAsync(channelId, cancellationToken), cancellationToken);
    }

    [HttpPost("{channelId:int}/play")]
    public Task<IActionResult> Play(int channelId, CancellationToken cancellationToken)
    {
        return CommandAsync(channelId, () => playback.PlayAsync(channelId, cancellationToken), cancellationToken);
    }

    [HttpPost("{channelId:int}/pause")]
    public Task<IActionResult> Pause(int channelId, CancellationToken cancellationToken)
    {
        return CommandAsync(channelId, () => playback.PauseAsync(channelId, cancellationToken), cancellationToken);
    }

    private Task<IActionResult> CommandAsync(int channelId, Func<Task> command, CancellationToken cancellationToken)
    {
        return RunAsync(async () =>
        {
            await command();
            await RepublishAsync(channelId, cancellationToken);

            return NoContent();
        });
    }

    private async Task<IActionResult> RunAsync(Func<Task<IActionResult>> action)
    {
        if (!serviceToken.Matches(Request))
        {
            logger.LogWarning("An unauthenticated caller tried to reach the internal Spotify API");
            return Unauthorized();
        }

        try
        {
            return await action();
        }
        catch (SpotifyException exception)
        {
            return SpotifyResults.From(exception);
        }
    }

    /// <summary>
    /// A chat command changes what an open dashboard is showing, and the dashboard has no other way
    /// to hear about it inside the poller's five seconds.
    /// </summary>
    private async Task RepublishAsync(int channelId, CancellationToken cancellationToken)
    {
        try
        {
            var state = await playback.GetPlaybackAsync(channelId, cancellationToken);
            var queue = await queues.GetAsync(channelId, SpotifyLimits.QueueLength, cancellationToken);

            hub.Publish(channelId, new SpotifyEvent(state, queue));
        }
        catch (SpotifyException exception)
        {
            logger.LogDebug(
                "Could not push the new Spotify state for channel {ChannelId}: {Reason}", channelId, exception.Reason);
        }
    }
}
