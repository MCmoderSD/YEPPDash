using System.Security.Cryptography;
using System.Text;

namespace YEPPDash.Api.Auth;

// AES-256-GCM with the key derived from the Twitch client secret, so the deployment needs exactly
// one secret and no separate key management. Consequence, identical to Helix-API's model: rotating
// the client secret makes every stored token unreadable and forces users to log in again.
//
// GCM (authenticated, random nonce per record) rather than the AES-ECB layout Helix-API uses —
// ECB is deterministic, so identical plaintexts produce identical ciphertexts. YEPPDash owns its
// table, so there is no reason to inherit that weakness.
//
// Wire format: base64( nonce[12] || tag[16] || ciphertext )
public sealed class AesGcmTokenCipher : ITokenCipher
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private readonly byte[] key;

    public AesGcmTokenCipher(string clientSecret)
    {
        key = SHA256.HashData(Encoding.UTF8.GetBytes(clientSecret));
    }

    public string Protect(string plaintext)
    {
        var plainBytes = Encoding.UTF8.GetBytes(plaintext);
        var result = new byte[NonceSize + TagSize + plainBytes.Length];

        var nonce = result.AsSpan(0, NonceSize);
        var tag = result.AsSpan(NonceSize, TagSize);
        var ciphertext = result.AsSpan(NonceSize + TagSize);

        RandomNumberGenerator.Fill(nonce);

        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(nonce, plainBytes, ciphertext, tag);

        return Convert.ToBase64String(result);
    }

    public string Unprotect(string ciphertext)
    {
        var raw = Convert.FromBase64String(ciphertext);
        if (raw.Length < NonceSize + TagSize)
        {
            throw new CryptographicException("Stored token is too short to be a valid AES-GCM payload.");
        }

        var nonce = raw.AsSpan(0, NonceSize);
        var tag = raw.AsSpan(NonceSize, TagSize);
        var payload = raw.AsSpan(NonceSize + TagSize);
        var plainBytes = new byte[payload.Length];

        using var aes = new AesGcm(key, TagSize);
        aes.Decrypt(nonce, payload, tag, plainBytes);

        return Encoding.UTF8.GetString(plainBytes);
    }
}
