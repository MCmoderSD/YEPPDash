using MySqlConnector;
using YEPPDash.Api.Data;
using YEPPDash.Api.Repositories;

namespace YEPPDash.Api.Services;

/// <summary>
/// Thrown when the channel has no row in YEPPBot's Channel table, so a quote cannot reference it.
/// </summary>
public sealed class UnknownQuoteChannelException(int channelId, Exception inner)
    : Exception($"Channel {channelId} is not known to YEPPBot.", inner);

public sealed class QuoteService(QuoteRepository repository, ILogger<QuoteService> logger)
{
    public Task<IReadOnlyList<Quote>> GetAsync(string channelId, CancellationToken cancellationToken)
    {
        return repository.GetAllAsync(ParseChannelId(channelId), cancellationToken);
    }

    public async Task<Quote> AddAsync(string channelId, string text, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);

        try
        {
            var quote = await repository.AddAsync(id, Normalize(text), cancellationToken);
            logger.LogInformation("Added quote {QuoteId} to channel {ChannelId}", quote.Id, id);

            return quote;
        }
        catch (MySqlException exception) when (exception.ErrorCode is MySqlErrorCode.NoReferencedRow or MySqlErrorCode.NoReferencedRow2)
        {
            throw new UnknownQuoteChannelException(id, exception);
        }
    }

    public async Task<Quote?> UpdateAsync(string channelId, int quoteId, string text, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);
        var quote = await repository.UpdateAsync(id, quoteId, Normalize(text), cancellationToken);

        if (quote is not null) logger.LogInformation("Updated quote {QuoteId} of channel {ChannelId}", quoteId, id);
        return quote;
    }

    public async Task<bool> DeleteAsync(string channelId, int quoteId, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);
        var deleted = await repository.DeleteAsync(id, quoteId, cancellationToken);

        if (deleted) logger.LogInformation("Deleted quote {QuoteId} of channel {ChannelId}", quoteId, id);
        return deleted;
    }

    public async Task<IReadOnlyList<Quote>?> MoveAsync(
        string channelId, int quoteId, int position, CancellationToken cancellationToken)
    {
        var id = ParseChannelId(channelId);
        var quotes = await repository.MoveAsync(id, quoteId, position, cancellationToken);

        if (quotes is not null)
        {
            logger.LogInformation(
                "Moved quote {QuoteId} of channel {ChannelId} to position {Position}", quoteId, id, position);
        }

        return quotes;
    }

    private static string Normalize(string text)
    {
        return text.Trim();
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
