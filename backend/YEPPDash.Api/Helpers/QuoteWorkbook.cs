using ClosedXML.Excel;
using YEPPDash.Api.Data.Quote;
using YEPPDash.Api.Exceptions.Quote;

namespace YEPPDash.Api.Helpers;

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

        if (cell.TryGetValue(out DateTime value))
        {
            return new DateTimeOffset(value.AsUtc());
        }

        return DateTimeOffset.TryParse(cell.GetString(), out var parsed) ? parsed : null;
    }
}
