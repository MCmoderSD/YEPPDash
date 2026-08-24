using System.Text.Json;
using System.Text.Json.Serialization;
using YEPPDash.Api.Auth;

namespace YEPPDash.Api.Spotify;

/// <summary>
/// The OAuth <c>state</c> for linking Spotify, carrying its own payload instead of pointing at a
/// cookie.
/// <para>
/// The Twitch login can use a cookie because its callback lands on the same host that set one.
/// Spotify's cannot: <c>localhost</c> is not a redirect URI Spotify accepts at all — only an
/// explicit loopback literal like <c>127.0.0.1</c> — and to a browser that is a different host, so
/// neither the session cookie nor a state cookie is sent with the callback.
/// </para>
/// <para>
/// Encrypted rather than merely signed, with the same AES-GCM key that protects the stored tokens,
/// so it is both unforgeable and opaque. That is what keeps it a CSRF defence without a cookie: an
/// attacker can obtain a state for <em>their own</em> channel by starting a link, and injecting it
/// into someone else's callback links their Spotify to their own channel and changes nothing for
/// the victim. Getting one minted for a channel they do not own would mean already holding that
/// channel's session.
/// </para>
/// </summary>
public static class SpotifyConnectState
{
    /// <summary>
    /// Long enough to read a consent screen, short enough that a state left in a browser's history
    /// is dead by the time anyone finds it.
    /// </summary>
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);

    public static string Issue(ITokenCipher cipher, int channelId, string? returnUrl)
    {
        var payload = new StatePayload(channelId, returnUrl, DateTimeOffset.UtcNow.Add(Lifetime).ToUnixTimeSeconds());

        return ToUrlSafe(cipher.Protect(JsonSerializer.Serialize(payload)));
    }

    public static bool TryConsume(ITokenCipher cipher, string? state, out int channelId, out string? returnUrl)
    {
        channelId = 0;
        returnUrl = null;

        if (string.IsNullOrEmpty(state)) return false;

        StatePayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<StatePayload>(cipher.Unprotect(FromUrlSafe(state)));
        }
        catch (Exception exception) when (exception is FormatException or JsonException or System.Security.Cryptography.CryptographicException)
        {
            // Anything that will not decrypt was not minted here. There is nothing to distinguish
            // between a tampered state, a truncated one and one from a deployment with another key.
            return false;
        }

        if (payload is null || DateTimeOffset.UtcNow.ToUnixTimeSeconds() > payload.ExpiresAt) return false;

        channelId = payload.ChannelId;
        returnUrl = payload.ReturnUrl;

        return true;
    }

    // Base64 carries '+' and '/', which survive a query string only until something decodes '+' as a
    // space. The URL-safe alphabet sidesteps that instead of trusting every hop to be careful.
    private static string ToUrlSafe(string base64)
    {
        return base64.TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static string FromUrlSafe(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');

        return padded.PadRight((padded.Length + 3) / 4 * 4, '=');
    }

    private sealed record StatePayload(
        [property: JsonPropertyName("c")] int ChannelId,
        [property: JsonPropertyName("r")] string? ReturnUrl,
        [property: JsonPropertyName("e")] long ExpiresAt
    );
}
