using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Birthday;
using YEPPDash.Api.Exceptions.Birthday;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("birthday")]
public sealed class BirthdayController(BirthdayService birthdays, ILogger<BirthdayController> logger)
    : ControllerBase
{
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
            logger.LogWarning(exception, "Cannot read the followers of channel {UserId}", userId);
            return StatusCode(StatusCodes.Status502BadGateway);
        }
    }

    [HttpGet("{userId:int}")]
    public async Task<IActionResult> GetBirthday(string userId, CancellationToken cancellationToken)
    {
        var birthday = await birthdays.GetAsync(userId, cancellationToken);

        return birthday is null ? NotFound() : Ok(BirthdayResponse.From(birthday));
    }

    [HttpPost("{userId:int}")]
    public async Task<IActionResult> AddBirthday(string userId, [FromBody] BirthdayRequest request, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;
        if (request.Problem(Today) is { } problem) return BadRequest(problem);

        try
        {
            var birthday = await birthdays.AddAsync(userId, request.Day, request.Month, request.Year, cancellationToken);

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
    public async Task<IActionResult> UpdateBirthday(string userId, [FromBody] BirthdayRequest request, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;
        if (request.Problem(Today) is { } problem) return BadRequest(problem);

        var birthday = await birthdays.UpdateAsync(
            userId, request.Day, request.Month, request.Year, cancellationToken);

        return birthday is null ? NotFound() : Ok(BirthdayResponse.From(birthday));
    }

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    private IActionResult? Denied(string userId)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (!string.Equals(twitchId, userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to reach the birthdays of user {UserId}", twitchId, userId);
            return Forbid();
        }

        return null;
    }
}