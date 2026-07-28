using System.Security.Cryptography;
using System.Text;

namespace YEPPDash.Api.Auth;

public sealed class AesGcmTokenCipher(string clientSecret) : ITokenCipher
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private readonly byte[] _key = SHA256.HashData(Encoding.UTF8.GetBytes(clientSecret));

    public string Protect(string plaintext)
    {
        var plainBytes = Encoding.UTF8.GetBytes(plaintext);
        var result = new byte[NonceSize + TagSize + plainBytes.Length];

        var nonce = result.AsSpan(0, NonceSize);
        var tag = result.AsSpan(NonceSize, TagSize);
        var ciphertext = result.AsSpan(NonceSize + TagSize);

        RandomNumberGenerator.Fill(nonce);

        using var aes = new AesGcm(_key, TagSize);
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

        using var aes = new AesGcm(_key, TagSize);
        aes.Decrypt(nonce, payload, tag, plainBytes);

        return Encoding.UTF8.GetString(plainBytes);
    }
}