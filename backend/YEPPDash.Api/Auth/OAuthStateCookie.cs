using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace YEPPDash.Api.Auth;

// CSRF protection for the authorization-code flow (RFC 6749 §10.12). The OIDC middleware used to
// do this implicitly; driving OAuth2 by hand means owning it explicitly.
//
// A random nonce goes out as the `state` query parameter and, together with the return URL, into a
// short-lived HttpOnly cookie. On the callback both must match, which is only possible for a
// browser that actually started the flow here.
//
// SameSite=Lax is correct even across sites: the callback is a top-level GET navigation, which Lax
// explicitly permits.
public static class OAuthStateCookie
{
    public const string Name = "yeppdash.oauth-state";

    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);

    public static string Issue(HttpResponse response, string? returnUrl)
    {
        var nonce = Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var payload = JsonSerializer.SerializeToUtf8Bytes(new StatePayload(nonce, returnUrl));

        response.Cookies.Append(Name, Base64UrlEncode(payload), new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            IsEssential = true,
            Expires = DateTimeOffset.UtcNow.Add(Lifetime)
        });

        return nonce;
    }

    // Single-use: the cookie is dropped whether or not validation succeeded, so a leaked state
    // value cannot be replayed. Returns false for every failure mode — missing, malformed or
    // mismatched — because the caller has no reason to treat them differently.
    public static bool TryConsume(HttpRequest request, HttpResponse response, string? state, out string? returnUrl)
    {
        returnUrl = null;

        var cookie = request.Cookies[Name];
        Delete(response);

        if (string.IsNullOrEmpty(cookie) || string.IsNullOrEmpty(state))
        {
            return false;
        }

        StatePayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<StatePayload>(Base64UrlDecode(cookie));
        }
        catch (Exception exception) when (exception is FormatException or JsonException)
        {
            return false;
        }

        if (payload is null || !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(payload.Nonce), Encoding.UTF8.GetBytes(state)))
        {
            return false;
        }

        returnUrl = payload.ReturnUrl;
        return true;
    }

    public static void Delete(HttpResponse response)
    {
        response.Cookies.Delete(Name, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax
        });
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(padded.PadRight((padded.Length + 3) / 4 * 4, '='));
    }

    private sealed record StatePayload(
        [property: JsonPropertyName("n")] string Nonce,
        [property: JsonPropertyName("r")] string? ReturnUrl
    );
}
