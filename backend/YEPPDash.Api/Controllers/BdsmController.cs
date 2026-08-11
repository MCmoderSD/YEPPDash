using MCmoderSD.BdsmTestApi.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Bdsm;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("bdsm")]
public sealed class BdsmController(BdsmService results, ILogger<BdsmController> logger) : ControllerBase
{
    private Language? _language;

    private Language Language => _language ??= Request.GetBdsmLanguage();

    [HttpGet("{userId:int}")]
    public Task<IActionResult> GetResults(string userId, CancellationToken cancellationToken)
    {
        return Guarded([userId], async () =>
        {
            var found = await results.GetForUserAsync(userId, cancellationToken);
            return Ok(found.Select(result => BdsmResultResponse.From(result, Language)));
        }, cancellationToken);
    }

    [HttpPost]
    public Task<IActionResult> GetResults([FromBody] string[] userIds, CancellationToken cancellationToken)
    {
        return Guarded(userIds, async () =>
        {
            var found = await results.GetForUsersAsync(userIds, cancellationToken);
            return Ok(found.Select(result => BdsmResultResponse.From(result, Language)));
        }, cancellationToken);
    }

    [HttpGet("match/{userId:int}/{partnerId:int}")]
    public Task<IActionResult> GetMatch(string userId, string partnerId, CancellationToken cancellationToken)
    {
        return Guarded([userId, partnerId], async () =>
        {
            var match = await results.MatchAsync(userId, partnerId, cancellationToken);
            return match is null ? NotFound() : Ok(BdsmMatchResponse.From(match, Language));
        }, cancellationToken);
    }

    [HttpPost("match/{userId:int}")]
    public Task<IActionResult> GetMatches(string userId, [FromBody] string[] partnerIds, CancellationToken cancellationToken)
    {
        return Guarded([userId, .. partnerIds], async () =>
        {
            var matches = await results.MatchAsync(userId, partnerIds, cancellationToken);
            return Ok(matches.Select(match => BdsmMatchResponse.From(match, Language)));
        }, cancellationToken);
    }

    [HttpPost("match/{userId:int}/scores")]
    public Task<IActionResult> GetMatchScores(string userId, [FromBody] string[] partnerIds, CancellationToken cancellationToken)
    {
        return Guarded([userId, .. partnerIds], async () => Ok(await results.ScoreAsync(userId, partnerIds, cancellationToken)), cancellationToken);
    }

    [HttpPost("match")]
    public Task<IActionResult> GetMatches([FromBody] BdsmPair[] pairs, CancellationToken cancellationToken)
    {
        var involved = pairs.SelectMany(pair => new[] { pair.UserId, pair.PartnerId }).ToList();

        return Guarded(involved, async () =>
        {
            var matches = await results.MatchPairsAsync(pairs, cancellationToken);
            return Ok(matches.Select(match => BdsmMatchResponse.From(match, Language)));
        }, cancellationToken);
    }

    private async Task<IActionResult> Guarded(IReadOnlyCollection<string> userIds, Func<Task<IActionResult>> run, CancellationToken cancellationToken)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        try
        {
            if (!await results.MayAccessAsync(twitchId, userIds, cancellationToken))
            {
                logger.LogWarning("User {TwitchId} tried to reach BDSM results outside their own channel", twitchId);
                return Forbid();
            }

            return await run();
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            logger.LogWarning(exception, "Cannot read the followers of channel {TwitchId}", twitchId);
            return StatusCode(StatusCodes.Status502BadGateway);
        }
    }
}