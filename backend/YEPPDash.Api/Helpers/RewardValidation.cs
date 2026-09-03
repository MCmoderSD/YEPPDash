using System.Text.RegularExpressions;

namespace YEPPDash.Api.Helpers;

public static partial class RewardValidation
{
    public const int TitleMaxLength = 45;
    public const int PromptMaxLength = 200;
    public const long CooldownMaxSeconds = 604_800;

    public sealed record Fields(
        string? Title,
        long Cost,
        string? Prompt,
        string? BackgroundColor,
        long? CooldownSeconds,
        long? MaxPerStream,
        long? MaxPerUserPerStream);

    public static string? Invalid(Fields fields, string subject)
    {
        if (string.IsNullOrWhiteSpace(fields.Title)) return $"The {subject} needs a name.";
        if (fields.Title.Length > TitleMaxLength) return $"A reward name cannot be longer than {TitleMaxLength} characters.";
        if (fields.Cost < 1) return "A reward has to cost at least 1 channel point.";
        if (fields.Prompt?.Length > PromptMaxLength) return $"A reward description cannot be longer than {PromptMaxLength} characters.";
        if (fields.BackgroundColor is not null && !HexColor().IsMatch(fields.BackgroundColor)) return "A background color has to be a hex color like #9147FF.";
        if (fields.CooldownSeconds is < 0 or > CooldownMaxSeconds) return $"A cooldown has to be between 0 and {CooldownMaxSeconds} seconds.";
        if (fields.MaxPerStream is < 0) return "A per-stream limit cannot be negative.";
        if (fields.MaxPerUserPerStream is < 0) return "A per-user limit cannot be negative.";

        return null;
    }

    [GeneratedRegex("^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")]
    public static partial Regex HexColor();
}