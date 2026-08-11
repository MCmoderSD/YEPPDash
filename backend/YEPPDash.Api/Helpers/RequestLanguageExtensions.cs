using MCmoderSD.BdsmTestApi.Enums;
using Microsoft.Net.Http.Headers;

namespace YEPPDash.Api.Helpers;

public static class RequestLanguageExtensions
{
    extension(HttpRequest request)
    {
        // Which of the package's 18 languages to name kinks in. The dashboard has no language
        // setting of its own — it formats dates off the browser's locale — so the browser's own
        // Accept-Language is the closest thing to one, and English stands in when none of it fits.
        public Language GetBdsmLanguage()
        {
            var accepted = request.Headers.AcceptLanguage;
            if (accepted.Count is 0) return Language.English;

            if (!StringWithQualityHeaderValue.TryParseList(accepted, out var candidates)) return Language.English;

            foreach (var candidate in candidates.OrderByDescending(entry => entry.Quality ?? 1))
            {
                // "de-DE" and "de" both mean German here; the package keys off the primary subtag.
                var tag = candidate.Value.Value;
                var primary = tag?.Split('-')[0];

                if (LanguageExtensions.TryFromCode(primary, out var language)) return language;
            }

            return Language.English;
        }
    }
}
