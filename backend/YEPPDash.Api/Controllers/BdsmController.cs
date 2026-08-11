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
    // A channel's follower list is the upper bound the frontend posts here, so the cap is loose;
    // it only exists so a hand-written request cannot ask for unbounded work.
    private const int MaxUsers = 1000;

    [HttpGet("{userId:int}")]
    public Task<IActionResult> GetResults(string userId, CancellationToken cancellationToken)
    {
        return Guarded([userId], async () =>
        {
            var found = await results.GetForUserAsync(userId, cancellationToken);
            return Ok(found.Select(BdsmResultResponse.From));
        }, cancellationToken);
    }

    // The newest result of everyone in the list who has one; users without a result are simply
    // absent from the answer.
    [HttpPost]
    public Task<IActionResult> GetResults([FromBody] string[] userIds, CancellationToken cancellationToken)
    {
        if (TooMany(userIds) is { } tooMany) return Task.FromResult(tooMany);

        return Guarded(userIds, async () =>
        {
            var found = await results.GetForUsersAsync(userIds, cancellationToken);
            return Ok(found.Select(BdsmResultResponse.From));
        }, cancellationToken);
    }

    [HttpGet("match/{userId:int}/{partnerId:int}")]
    public Task<IActionResult> GetMatch(string userId, string partnerId, CancellationToken cancellationToken)
    {
        return Guarded([userId, partnerId], async () =>
        {
            var match = await results.MatchAsync(userId, partnerId, cancellationToken);
            return match is null ? NotFound() : Ok(BdsmMatchResponse.From(match));
        }, cancellationToken);
    }

    [HttpPost("match/{userId:int}")]
    public Task<IActionResult> GetMatches(string userId, [FromBody] string[] partnerIds, CancellationToken cancellationToken)
    {
        if (TooMany(partnerIds) is { } tooMany) return Task.FromResult(tooMany);

        return Guarded([userId, .. partnerIds], async () =>
        {
            var matches = await results.MatchAsync(userId, partnerIds, cancellationToken);
            return Ok(matches.Select(BdsmMatchResponse.From));
        }, cancellationToken);
    }

    [HttpPost("match")]
    public Task<IActionResult> GetMatches([FromBody] BdsmPair[] pairs, CancellationToken cancellationToken)
    {
        if (TooMany(pairs) is { } tooMany) return Task.FromResult(tooMany);

        var involved = pairs.SelectMany(pair => new[] { pair.UserId, pair.PartnerId }).ToList();

        return Guarded(involved, async () =>
        {
            var matches = await results.MatchPairsAsync(pairs, cancellationToken);
            return Ok(matches.Select(BdsmMatchResponse.From));
        }, cancellationToken);
    }

    // Every endpoint answers for a set of users, and all of them are allowed to the caller and the
    // people following their channel — so the check is the same one everywhere.
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

    private IActionResult? TooMany<T>(IReadOnlyCollection<T> entries)
    {
        return entries.Count > MaxUsers ? BadRequest($"At most {MaxUsers} entries per request.") : null;
    }
}
