using ClosedXML.Excel;
using YEPPDash.Api.Data;

namespace YEPPDash.Api.Helpers;

/// <summary>
/// Raised when an uploaded workbook cannot be read as a quote list. The message is meant to be
/// shown to the user, so it names the row that is wrong rather than the internal failure.
/// </summary>
public sealed class QuoteWorkbookException(string message) : Exception(message);

/// <summary>
/// Reads and writes the .xlsx shape used by the quote import and export: one header row, then
/// <c>ID | Message | Date</c>.
/// </summary>
public static class QuoteWorkbook
{
    public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private const string SheetName = "Quotes";
    private const int IdColumn = 1;
    private const int MessageColumn = 2;
    private const int DateColumn = 3;

    public static byte[] Write(IReadOnlyList<Quote> quotes)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet(SheetName);

        sheet.Cell(1, IdColumn).Value = "ID";
        sheet.Cell(1, MessageColumn).Value = "Message";
        sheet.Cell(1, DateColumn).Value = "Date";
        sheet.Row(1).Style.Font.Bold = true;
        sheet.SheetView.FreezeRows(1);

        for (var index = 0; index < quotes.Count; index++)
        {
            var quote = quotes[index];
            var row = index + 2;

            sheet.Cell(row, IdColumn).Value = quote.Id;
            sheet.Cell(row, MessageColumn).Value = quote.Text;

            // Written as a real date cell rather than text so Excel sorts and filters it properly.
            sheet.Cell(row, DateColumn).Value = quote.Timestamp.UtcDateTime;
            sheet.Cell(row, DateColumn).Style.DateFormat.Format = "yyyy-mm-dd hh:mm:ss";
        }

        sheet.Column(MessageColumn).Width = 80;
        sheet.Column(MessageColumn).Style.Alignment.WrapText = true;
        sheet.Column(IdColumn).AdjustToContents();
        sheet.Column(DateColumn).AdjustToContents();

        using var buffer = new MemoryStream();
        workbook.SaveAs(buffer);

        return buffer.ToArray();
    }

    /// <summary>
    /// Reads the quotes from an uploaded workbook, ordered by the ID column when it is filled in.
    /// </summary>
    public static IReadOnlyList<QuoteDraft> Read(Stream stream)
    {
        using var workbook = Open(stream);
        var sheet = workbook.Worksheets.FirstOrDefault()
            ?? throw new QuoteWorkbookException("The workbook has no sheets.");

        var drafts = new List<(int? Id, QuoteDraft Draft)>();
        var used = sheet.LastRowUsed()?.RowNumber() ?? 0;

        for (var row = 2; row <= used; row++)
        {
            var text = sheet.Cell(row, MessageColumn).GetString().Trim();

            // Blank lines are skipped rather than rejected: a spreadsheet people have edited by
            // hand usually has a few, and failing the whole import over one is not helpful.
            if (string.IsNullOrWhiteSpace(text)) continue;

            if (text.Length > QuoteLimits.MaxLength)
            {
                throw new QuoteWorkbookException(
                    $"Row {row}: the message is {text.Length} characters, the limit is {QuoteLimits.MaxLength}.");
            }

            drafts.Add((ReadId(sheet, row), new QuoteDraft(text, ReadTimestamp(sheet, row))));
        }

        if (drafts.Count is 0)
        {
            throw new QuoteWorkbookException(
                $"No quotes found. Expected a header row, then one quote per row with the message in column {MessageColumn}.");
        }

        // The ID column only decides the order — the positions are handed out fresh on import, so
        // gaps or duplicates in the file are not worth rejecting. Rows without an ID keep their
        // position in the sheet.
        return drafts
            .Select((entry, index) => (entry.Id, entry.Draft, Fallback: index))
            .OrderBy(entry => entry.Id ?? int.MaxValue)
            .ThenBy(entry => entry.Fallback)
            .Select(entry => entry.Draft)
            .ToList();
    }

    private static XLWorkbook Open(Stream stream)
    {
        try
        {
            return new XLWorkbook(stream);
        }
        catch (Exception exception)
        {
            throw new QuoteWorkbookException($"The file could not be read as an Excel workbook: {exception.Message}");
        }
    }

    private static int? ReadId(IXLWorksheet sheet, int row)
    {
        var cell = sheet.Cell(row, IdColumn);
        if (cell.IsEmpty()) return null;

        return cell.TryGetValue(out int id) ? id : null;
    }

    private static DateTimeOffset? ReadTimestamp(IXLWorksheet sheet, int row)
    {
        var cell = sheet.Cell(row, DateColumn);
        if (cell.IsEmpty()) return null;

        // A date cell comes back as DateTime; a sheet typed by hand hands over a string instead.
        if (cell.TryGetValue(out DateTime value))
        {
            return new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Utc));
        }

        return DateTimeOffset.TryParse(cell.GetString(), out var parsed) ? parsed : null;
    }
}
