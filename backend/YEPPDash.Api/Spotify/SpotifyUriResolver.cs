using System.Text.RegularExpressions;

namespace YEPPDash.Api.Spotify;

public enum SpotifyItemKind
{
    Track,
    Episode
}

public sealed record SpotifyReference(SpotifyItemKind Kind, string Id);

/// <summary>
/// Turns whatever someone typed into a Spotify id, or into nothing — in which case it was a search
/// term all along. This is the only place in either half of the project that knows what a Spotify
/// link looks like; the bot forwards raw text precisely so a new link shape is a change here alone.
/// </summary>
public static partial class SpotifyUriResolver
{
    public static SpotifyReference? Resolve(string input)
    {
        var value = input.Trim();
        if (value.Length is 0) return null;

        // A bare id is what is left over once someone has trimmed a shared URL by hand, and it is
        // short enough that people do type it.
        if (BareId().IsMatch(value)) return new SpotifyReference(SpotifyItemKind.Track, value);

        var match = Link().Match(value);
        if (!match.Success) return null;

        var kind = match.Groups["kind"].Value.Equals("episode", StringComparison.OrdinalIgnoreCase)
            ? SpotifyItemKind.Episode
            : SpotifyItemKind.Track;

        return new SpotifyReference(kind, match.Groups["id"].Value);
    }

    [GeneratedRegex("^[A-Za-z0-9]{22}$")]
    private static partial Regex BareId();

    /// <summary>
    /// Covers the shapes a link actually arrives in. The <c>intl-de</c> segment is the one that gets
    /// forgotten: Spotify's share button adds it whenever the client is not set to English, so a
    /// resolver without it fails for most of a German chat while working perfectly in testing.
    /// The <c>?si=</c> tracking parameter is simply never matched, which is the same as stripping it.
    /// <para>
    /// Both alternatives reuse the name <c>kind</c>, which .NET allows and most other engines do
    /// not — whichever branch matched is the one the group holds.
    /// </para>
    /// </summary>
    [GeneratedRegex(
        """
        ^(?:
            (?:https?://)?open\.spotify\.com/
            (?:intl-[A-Za-z]{2}(?:-[A-Za-z0-9]+)?/)?
            (?:embed/)?
            (?<kind>track|episode)/
          |
            spotify:(?<kind>track|episode):
        )
        (?<id>[A-Za-z0-9]{22})
        """,
        RegexOptions.IgnoreCase | RegexOptions.IgnorePatternWhitespace)]
    private static partial Regex Link();
}
