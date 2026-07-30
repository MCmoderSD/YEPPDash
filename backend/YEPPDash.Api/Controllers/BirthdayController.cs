using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.Controllers;

/// <summary>
/// Birthdays out of YEPPBot's Birthday table. Any signed-in user may read a single birthday; writing
/// one, and reading the whole list for a channel's followers, is limited to the owner.
/// </summary>
/// <remarks>
/// Every route pins the id to an int. The column behind it is an INT primary key, so an id that is
/// not one cannot name a row — and pinning it in the route means the id is never parsed anywhere
/// that would have to answer for the failure.
/// </remarks>
[ApiController]
[Authorize]
[Route("birthday")]
public sealed class BirthdayController(BirthdayService birthdays, ILogger<BirthdayController> logger)
    : ControllerBase
{
    /// <summary>
    /// The birthdays of everyone following the channel, plus the channel owner's own.
    /// </summary>
    /// <remarks>
    /// Owner-only, unlike the single birthday below, and the one place in here where that is about
    /// more than write access: the follower list is fetched with the broadcaster's own stored Twitch
    /// token, so letting a caller name somebody else would hand them a read of another channel's
    /// followers. Sits on its own route rather than under this controller's, because the id names the
    /// channel to look at rather than the person the birthday belongs to.
    /// </remarks>
    [HttpGet("~/birthdays/{userId:int}")]
    public async Task<IActionResult> GetFollowerBirthdays(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        try
        {
            var found = await birthdays.GetForFollowersAsync(userId, cancellationToken);
            return Ok(found.Select(BirthdayResponse.From));
        }
        catch (Exception exception) when (exception is TwitchOAuthException or HttpRequestException)
        {
            // Coarser than TwitchController's mapping on purpose: the only way to get here is a
            // missing token or an unreachable Twitch, and neither is the caller's to fix.
            logger.LogWarning(exception, "Cannot read the followers of channel {UserId}", userId);
            return StatusCode(StatusCodes.Status502BadGateway);
        }
    }

    [HttpGet("{userId:int}")]
    public async Task<IActionResult> GetBirthday(string userId, CancellationToken cancellationToken)
    {
        // No ownership check: a birthday is public within the dashboard, and [Authorize] has already
        // established that there is a session behind the request.
        var birthday = await birthdays.GetAsync(userId, cancellationToken);

        return birthday is null ? NotFound() : Ok(BirthdayResponse.From(birthday));
    }

    [HttpPost("{userId:int}")]
    public async Task<IActionResult> AddBirthday(
        string userId, [FromBody] BirthdayRequest request, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;
        if (request.Problem(Today) is { } problem) return BadRequest(problem);

        try
        {
            var birthday = await birthdays.AddAsync(
                userId, request.Day, request.Month, request.Year, cancellationToken);

            // Adding over an existing birthday would quietly overwrite it, which is what PATCH is
            // for — so it is refused here rather than guessed at.
            if (birthday is null) return Conflict("This user already has a birthday. Update it instead.");

            return CreatedAtAction(nameof(GetBirthday), new { userId }, BirthdayResponse.From(birthday));
        }
        catch (UnknownBirthdayUserException exception)
        {
            logger.LogWarning(exception, "Cannot store a birthday for user {UserId}", userId);
            return Conflict("YEPPBot does not know this user yet, so it cannot store a birthday.");
        }
    }

    [HttpPatch("{userId:int}")]
    public async Task<IActionResult> UpdateBirthday(
        string userId, [FromBody] BirthdayRequest request, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;
        if (request.Problem(Today) is { } problem) return BadRequest(problem);

        var birthday = await birthdays.UpdateAsync(
            userId, request.Day, request.Month, request.Year, cancellationToken);

        return birthday is null ? NotFound() : Ok(BirthdayResponse.From(birthday));
    }

    /// <remarks>
    /// UTC rather than local time: the server's zone is not the user's, and a birthday is a calendar
    /// date rather than an instant, so the only thing this decides is how generous the "not in the
    /// future" rule is by up to a day.
    /// </remarks>
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    /// <returns>The result to return, or <c>null</c> when the caller may proceed.</returns>
    private IActionResult? Denied(string userId)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        // A birthday belongs to one user, and a session only ever speaks for its own. Without this
        // the route would let any signed-in user rewrite anybody's date of birth.
        if (!string.Equals(twitchId, userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to reach the birthdays of user {UserId}", twitchId, userId);
            return Forbid();
        }

        return null;
    }
}
