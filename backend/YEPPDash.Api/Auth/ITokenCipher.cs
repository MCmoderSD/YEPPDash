namespace YEPPDash.Api.Auth;

public interface ITokenCipher
{
    string Protect(string plaintext);

    string Unprotect(string ciphertext);
}