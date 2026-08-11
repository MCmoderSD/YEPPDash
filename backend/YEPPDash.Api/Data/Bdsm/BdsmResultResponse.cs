using System.Globalization;
using MCmoderSD.BdsmTestApi.Data;
using MCmoderSD.BdsmTestApi.Enums;

namespace YEPPDash.Api.Data.Bdsm;

public sealed record BdsmResultResponse(
    string Id,
    string UserId,
    DateTimeOffset Timestamp,
    int Version,
    string Gender,
    string AgeGroup,
    string Language,
    IReadOnlyDictionary<string, int> Traits
) {
    public static BdsmResultResponse From(BdsmUserResult entry)
    {
        return From(entry.UserId.ToString(CultureInfo.InvariantCulture), entry.Result);
    }

    public static BdsmResultResponse From(string userId, TestResult result)
    {
        return new BdsmResultResponse(
            result.Id,
            userId,
            result.Timestamp,
            result.Version,
            result.Gender,
            Label(result.AgeGroup),
            result.Language.GetCode(),
            Traits: result.Scores.ToDictionary(score => Key(score.Kink), score => score.Value, StringComparer.Ordinal));
    }

    // The frontend keys its trait table by the lower-camel-case kink name, which is what the
    // database columns used to be called too.
    private static string Key(Kink kink)
    {
        var name = kink.ToString();
        return string.Create(name.Length, name, (span, source) =>
        {
            source.CopyTo(span);
            span[0] = char.ToLowerInvariant(span[0]);
        });
    }

    private static string Label(AgeGroup ageGroup)
    {
        var min = ageGroup.GetMinAge();
        var max = ageGroup.GetMaxAge();

        if (min is 0) return $"<{max + 1}";
        if (max is int.MaxValue) return $"{min - 1}+";

        return $"{min}-{max}";
    }
}
