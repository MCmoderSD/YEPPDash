namespace YEPPDash.Api.Auth;

// Symmetric protection for tokens at rest. Kept behind an interface so the storage format can be
// swapped (for example to the AES-ECB/Base64 layout Helix-API uses) without touching the store.
public interface ITokenCipher
{
    string Protect(string plaintext);

    string Unprotect(string ciphertext);
}
