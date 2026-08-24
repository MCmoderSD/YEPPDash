using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Auth;
using YEPPDash.Api.Data.Spotify;
using YEPPDash.Api.Exceptions.Spotify;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Services;
using YEPPDash.Api.Spotify;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("spotify")]
public sealed class SpotifyController(
    SpotifyConnectionService connections,
    SongRequestService requests,
    ISpotifyPlaybackService playback,
    SpotifyQueueProjection queues,
    SpotifyRepository repository,
    SpotifyPlaybackHub hub,
    ITokenCipher cipher,
    IConfiguration configuration,
    ILogger<SpotifyController> logger) : ControllerBase
{
    private static readonly TimeSpan KeepAlive = TimeSpan.FromSeconds(20);

    #region Connection

    [HttpGet("{userId}/status")]
    public async Task<IActionResult> Status(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        return Ok(await connections.GetStatusAsync(int.Parse(userId), cancellationToken));
    }

    /// <summary>
    /// Starts the link. Takes no user id: the only account anyone may link is their own, and reading
    /// it from the session rather than the URL means there is no id to tamper with.
    /// </summary>
    [HttpGet("connect")]
    public IActionResult Connect(string? returnUrl)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (!connections.Configured) return SpotifyResults.From(new SpotifyNotConfiguredException());

        var target = IsAllowedReturnUrl(returnUrl) ? returnUrl : null;
        var state = SpotifyConnectState.Issue(cipher, int.Parse(twitchId), target);

        return Redirect(connections.BuildConnectUrl(state).ToString());
    }

    /// <summary>
    /// Deliberately anonymous. Spotify will not accept <c>localhost</c> as a redirect URI — only an
    /// explicit loopback literal — so in local development this lands on a host the browser considers
    /// different from the one that issued the session, and no cookie arrives with it. The channel is
    /// read out of the encrypted state instead, which is unforgeable and cannot be minted for a
    /// channel the caller does not already hold a session for.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("callback")]
    public async Task<IActionResult> Callback(
        [FromQuery] string? code,
        [FromQuery] string? state,
        [FromQuery] string? error,
        CancellationToken cancellationToken)
    {
        var valid = SpotifyConnectState.TryConsume(cipher, state, out var channelId, out var returnUrl);

        if (error is not null)
        {
            logger.LogInformation("Linking Spotify was aborted by the user: {Error}", error);
            return RedirectToFrontend(returnUrl, "spotify_denied");
        }

        if (!valid)
        {
            logger.LogWarning("Linking Spotify rejected: the state was missing, expired or not ours");
            return RedirectToFrontend(returnUrl, "invalid_state");
        }

        // Belt and braces where a session did come along: it costs nothing, and a mismatch is
        // something worth refusing rather than shrugging at.
        var twitchId = User.GetTwitchId();
        if (twitchId is not null && twitchId != channelId.ToString())
        {
            logger.LogWarning(
                "User {TwitchId} came back from Spotify holding a state for channel {ChannelId}", twitchId, channelId);

            return RedirectToFrontend(returnUrl, "invalid_state");
        }

        if (string.IsNullOrEmpty(code)) return RedirectToFrontend(returnUrl, "missing_code");

        try
        {
            await connections.CompleteAsync(channelId, code, cancellationToken);
        }
        catch (Exception exception) when (exception is SpotifyException or HttpRequestException)
        {
            logger.LogWarning(exception, "Could not finish linking Spotify for channel {ChannelId}", channelId);
            return RedirectToFrontend(returnUrl, "spotify_error");
        }

        return RedirectToFrontend(returnUrl, error: null);
    }

    [HttpDelete("{userId}/connection")]
    public async Task<IActionResult> Disconnect(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        var channelId = int.Parse(userId);

        await connections.DisconnectAsync(channelId, cancellationToken);
        hub.Publish(channelId, SpotifyEvent.Disconnected);

        return NoContent();
    }

    #endregion

    #region Playback

    [HttpGet("{userId}/state")]
    public Task<IActionResult> State(string userId, CancellationToken cancellationToken)
    {
        return RunAsync(userId, async channelId =>
            Ok(SpotifyPlaybackResponse.From(await playback.GetPlaybackAsync(channelId, cancellationToken))));
    }

    [HttpGet("{userId}/queue")]
    public Task<IActionResult> Queue(string userId, CancellationToken cancellationToken)
    {
        return RunAsync(userId, async channelId =>
            Ok(await queues.GetAsync(channelId, SpotifyLimits.QueueLength, cancellationToken)));
    }

    [HttpPost("{userId}/next")]
    public Task<IActionResult> Next(string userId, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, channelId => playback.SkipAsync(channelId, cancellationToken), cancellationToken);
    }

    [HttpPost("{userId}/play")]
    public Task<IActionResult> Play(string userId, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, channelId => playback.PlayAsync(channelId, cancellationToken), cancellationToken);
    }

    [HttpPost("{userId}/pause")]
    public Task<IActionResult> Pause(string userId, CancellationToken cancellationToken)
    {
        return CommandAsync(userId, channelId => playback.PauseAsync(channelId, cancellationToken), cancellationToken);
    }

    [HttpGet("{userId}/search")]
    public Task<IActionResult> Search(string userId, [FromQuery] string q, CancellationToken cancellationToken)
    {
        return RunAsync(userId, async channelId =>
        {
            if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<SpotifyTrack>());

            return Ok(await playback.SearchAsync(
                channelId, q.Trim(), SpotifyLimits.MaxSearchResults, cancellationToken));
        });
    }

    [HttpPost("{userId}/request")]
    public Task<IActionResult> Enqueue(
        string userId, [FromBody] SongRequestInput request, CancellationToken cancellationToken)
    {
        return RunAsync(userId, async channelId =>
        {
            var twitchId = User.GetTwitchId()!;

            // The broadcaster is the requester when the request came from their own dashboard.
            // Taking the name from the body would let the page write anyone into the log.
            var track = await requests.RequestAsync(
                channelId,
                request with { TwitchUserId = twitchId, TwitchUserName = User.Identity?.Name ?? twitchId },
                SongRequestSource.Dashboard,
                cancellationToken);

            await RepublishAsync(channelId, cancellationToken);

            return Ok(SongRequestAcceptedResponse.From(track));
        });
    }

    /// <summary>
    /// The live feed behind the "now playing" card. Unlike the wheel's and the timer's streams this
    /// one is not anonymous — it carries the device the music is coming out of, and who asked for
    /// what — so it runs under the session cookie and the same owner check as everything else here.
    /// </summary>
    [HttpGet("{userId}/stream")]
    public async Task Stream(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is not null || !int.TryParse(userId, out var channelId))
        {
            Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        await StreamAsync(channelId, SpotifyEvents.ForDashboard, "A dashboard", cancellationToken);
    }

    /// <summary>
    /// The OBS browser source. Anonymous, like the wheel's and the timer's overlays, because a
    /// browser source carries no session and the link has to work on whatever machine is streaming.
    /// <para>
    /// It is a narrower feed rather than the same one: what is playing is about to be audible on
    /// stream anyway, but the device name and the requester names have no business on a link anybody
    /// holding it can open. <c>SpotifyEvents.ForOverlay</c> is where that line is drawn.
    /// </para>
    /// </summary>
    [AllowAnonymous]
    [HttpGet("{userId}/overlay/stream")]
    public async Task OverlayStream(string userId, CancellationToken cancellationToken)
    {
        if (!int.TryParse(userId, out var channelId))
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        await StreamAsync(channelId, SpotifyEvents.ForOverlay, "An overlay", cancellationToken);
    }

    private async Task StreamAsync(
        int channelId, Func<SpotifyEvent, string> render, string who, CancellationToken cancellationToken)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache, no-store";
        Response.Headers["X-Accel-Buffering"] = "no";

        using var subscription = hub.Subscribe(channelId);
        logger.LogDebug("{Who} is watching the Spotify state of channel {ChannelId}", who, channelId);

        await WriteAsync(": connected\n\n", cancellationToken);

        // Whatever was last published, before waiting for the next change. Subscribing is also what
        // makes the poller start looking at this channel, so without this a browser source added
        // mid-stream would sit blank until something happened to change.
        if (hub.Latest(channelId) is { } held) await WriteAsync($"data: {render(held)}\n\n", cancellationToken);

        while (!cancellationToken.IsCancellationRequested)
        {
            SpotifyEvent change;

            try
            {
                using var idle = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                idle.CancelAfter(KeepAlive);

                change = await subscription.Reader.ReadAsync(idle.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                await WriteAsync(": keep-alive\n\n", cancellationToken);
                continue;
            }
            catch (OperationCanceledException)
            {
                break;
            }

            await WriteAsync($"data: {render(change)}\n\n", cancellationToken);
        }

        logger.LogDebug("{Who} stopped watching the Spotify state of channel {ChannelId}", who, channelId);
    }

    #endregion

    #region Settings and blocklist

    [HttpGet("{userId}/settings")]
    public async Task<IActionResult> Settings(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        return Ok(await repository.GetSettingsAsync(int.Parse(userId), cancellationToken));
    }

    [HttpPut("{userId}/settings")]
    public async Task<IActionResult> SaveSettings(
        string userId, [FromBody] SpotifySettingsRequest request, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        var settings = new SpotifySettings(
            int.Parse(userId),
            request.RequestsEnabled,
            Math.Clamp(request.CooldownSeconds, 0, SpotifyLimits.MaxCooldownSeconds),
            Math.Clamp(request.MaxDurationMs, 1, SpotifyLimits.MaxTrackDurationMs),
            request.RequestsLiveOnly);

        await repository.SaveSettingsAsync(settings, cancellationToken);

        return Ok(settings);
    }

    [HttpGet("{userId}/blocklist")]
    public async Task<IActionResult> Blocklist(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        return Ok(await repository.GetBlocklistAsync(int.Parse(userId), cancellationToken));
    }

    [HttpPost("{userId}/blocklist")]
    public async Task<IActionResult> Block(
        string userId, [FromBody] SpotifyBlocklistRequest request, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        if (string.IsNullOrWhiteSpace(request.EntryId)) return BadRequest("A blocklist entry needs a Spotify id.");

        var channelId = int.Parse(userId);

        await repository.AddBlockAsync(
            channelId,
            request.EntryType,
            request.EntryId.Trim(),
            request.Name.Trim(),
            Trim(request.Reason, SpotifyLimits.MaxBlocklistReasonLength),
            cancellationToken);

        return Ok(await repository.GetBlocklistAsync(channelId, cancellationToken));
    }

    [HttpDelete("{userId}/blocklist/{id:long}")]
    public async Task<IActionResult> Unblock(string userId, long id, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        return await repository.RemoveBlockAsync(int.Parse(userId), id, cancellationToken)
            ? NoContent()
            : NotFound();
    }

    [HttpGet("{userId}/history")]
    public async Task<IActionResult> History(
        string userId, [FromQuery] string? requestedBy, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        return Ok(await repository.GetHistoryAsync(
            int.Parse(userId),
            string.IsNullOrWhiteSpace(requestedBy) ? null : requestedBy.Trim(),
            SpotifyLimits.HistoryPageSize,
            cancellationToken));
    }

    #endregion

    private async Task<IActionResult> CommandAsync(
        string userId, Func<int, Task> command, CancellationToken cancellationToken)
    {
        return await RunAsync(userId, async channelId =>
        {
            await command(channelId);

            // Published straight away rather than waited for: the poller would find this within five
            // seconds, and a control that only reacts after five seconds feels broken.
            await RepublishAsync(channelId, cancellationToken);

            return NoContent();
        });
    }

    private async Task<IActionResult> RunAsync(string userId, Func<int, Task<IActionResult>> action)
    {
        if (Denied(userId) is { } denied) return denied;

        try
        {
            return await action(int.Parse(userId));
        }
        catch (SpotifyException exception)
        {
            return SpotifyResults.From(exception);
        }
    }

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
            // The command itself already succeeded. Failing to describe the result afterwards is
            // worth a line in the log and nothing more — the poller will catch up.
            logger.LogDebug(
                "Could not push the new Spotify state for channel {ChannelId}: {Reason}", channelId, exception.Reason);
        }
    }

    private async Task WriteAsync(string text, CancellationToken cancellationToken)
    {
        await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(text), cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);
    }

    private IActionResult? Denied(string userId)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (!int.TryParse(userId, out _)) return BadRequest("That is not a Twitch user ID.");

        if (!string.Equals(twitchId, userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to reach the Spotify of channel {UserId}", twitchId, userId);
            return Forbid();
        }

        return null;
    }

    private bool IsAllowedReturnUrl(string? returnUrl)
    {
        return
            returnUrl is not null
            && Uri.TryCreate(returnUrl, UriKind.Absolute, out var uri)
            && configuration.GetAllowedFrontendOrigins().Contains($"{uri.Scheme}://{uri.Authority}");
    }

    private IActionResult RedirectToFrontend(string? returnUrl, string? error)
    {
        var target = IsAllowedReturnUrl(returnUrl)
            ? returnUrl!
            : configuration.GetAllowedFrontendOrigins().FirstOrDefault();

        if (target is null) return error is null ? Ok() : BadRequest($"Linking Spotify failed: {error}");

        return Redirect(error is null ? target : $"{target}?error={Uri.EscapeDataString(error)}");
    }

    private static string? Trim(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var trimmed = value.Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
}
