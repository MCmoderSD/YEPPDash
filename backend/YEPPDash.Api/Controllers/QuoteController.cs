using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Data.Quote;
using YEPPDash.Api.Exceptions.Quote;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Controllers;

[ApiController]
[Authorize]
[Route("quotes")]
public sealed class QuoteController(QuoteService quotes, ILogger<QuoteController> logger) : ControllerBase
{
    private const int MaxUploadBytes = 5 * 1024 * 1024;


    [HttpGet("{userId}")]
    public async Task<IActionResult> GetQuotes(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        var found = await quotes.GetAsync(userId, cancellationToken);
        return Ok(found.Select(QuoteResponse.From));
    }

    [HttpPost("{userId}")]
    public async Task<IActionResult> AddQuote(string userId, [FromBody] QuoteTextRequest request, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;
        if (Blank(request.Quote)) return BadRequest("A quote cannot be blank.");

        try
        {
            var quote = await quotes.AddAsync(userId, request.Quote, cancellationToken);
            return CreatedAtAction(nameof(GetQuotes), new { userId }, QuoteResponse.From(quote));
        }
        catch (UnknownQuoteChannelException exception)
        {
            logger.LogWarning(exception, "Cannot add a quote for channel {UserId}", LogSafe.OneLine(userId));
            return Conflict("YEPPBot does not know this channel yet, so it cannot store quotes for it.");
        }
    }

    [HttpGet("{userId}/export")]
    public async Task<IActionResult> ExportQuotes(string userId, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        var workbook = await quotes.ExportAsync(userId, cancellationToken);
        var name = $"quotes-{userId}-{DateTime.UtcNow:yyyy-MM-dd}.xlsx";

        return File(workbook, QuoteWorkbook.ContentType, name);
    }

    [HttpPost("{userId}/import")]
    [RequestSizeLimit(MaxUploadBytes)]
    public async Task<IActionResult> ImportQuotes(string userId, IFormFile? file, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;
        if (file is null || file.Length is 0) return BadRequest("Attach an .xlsx file as 'file'.");

        try
        {
            await using var stream = file.OpenReadStream();
            var imported = await quotes.ImportAsync(userId, stream, cancellationToken);

            return Ok(imported.Select(QuoteResponse.From));
        }
        catch (QuoteWorkbookException exception)
        {
            logger.LogInformation("Rejected a quote import for {UserId}: {Reason}", LogSafe.OneLine(userId), LogSafe.OneLine(exception.Message));
            return BadRequest(exception.Message);
        }
        catch (UnknownQuoteChannelException exception)
        {
            logger.LogWarning(exception, "Cannot import quotes for channel {UserId}", LogSafe.OneLine(userId));
            return Conflict("YEPPBot does not know this channel yet, so it cannot store quotes for it.");
        }
    }

    [HttpPatch("{userId}/{id:int}")]
    public async Task<IActionResult> UpdateQuote(string userId, int id, [FromBody] QuoteTextRequest request, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;
        if (Blank(request.Quote)) return BadRequest("A quote cannot be blank.");

        var quote = await quotes.UpdateAsync(userId, id, request.Quote, cancellationToken);
        return quote is null ? NotFound() : Ok(QuoteResponse.From(quote));
    }

    [HttpDelete("{userId}/{id:int}")]
    public async Task<IActionResult> DeleteQuote(string userId, int id, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        return await quotes.DeleteAsync(userId, id, cancellationToken) ? NoContent() : NotFound();
    }

    [HttpPatch("{userId}/{id:int}/position")]
    public async Task<IActionResult> MoveQuote(string userId, int id, [FromBody] QuotePositionRequest request, CancellationToken cancellationToken)
    {
        if (Denied(userId) is { } denied) return denied;

        var reordered = await quotes.MoveAsync(userId, id, request.Position, cancellationToken);
        return reordered is null ? NotFound() : Ok(reordered.Select(QuoteResponse.From));
    }

    private IActionResult? Denied(string userId)
    {
        var twitchId = User.GetTwitchId();
        if (twitchId is null) return Unauthorized();

        if (!string.Equals(twitchId, userId, StringComparison.Ordinal))
        {
            logger.LogWarning("User {TwitchId} tried to reach the quotes of channel {UserId}", twitchId, LogSafe.OneLine(userId));
            return Forbid();
        }

        return null;
    }

    private static bool Blank(string quote)
    {
        return string.IsNullOrWhiteSpace(quote);
    }
}