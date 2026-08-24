using System.Security.Cryptography;
using System.Text;

namespace YEPPDash.Api.Auth;

/// <summary>
/// The shared secret on the endpoints YEPPBot calls. Deliberately not a Twitch session: the bot has
/// no user to be, and giving it one would mean minting a token that could do everything a
/// broadcaster can.
/// <para>
/// It is derived from the Twitch client secret exactly the way <c>YeppBotOptions</c> derives the key
/// for calls in the other direction, so both halves already agree on the value without a second
/// thing to configure and keep in step.
/// </para>
/// </summary>
public sealed class ServiceToken(string clientSecret)
{
    private readonly byte[] _expected =
        Encoding.UTF8.GetBytes(Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(clientSecret))));

    public bool Matches(HttpRequest request)
    {
        var header = request.Headers.Authorization.ToString();

        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return false;

        var presented = Encoding.UTF8.GetBytes(header["Bearer ".Length..].Trim());

        // Fixed-time, so that a wrong token cannot be narrowed down one character at a time by
        // measuring how long the rejection took.
        return CryptographicOperations.FixedTimeEquals(presented, _expected);
    }
}
