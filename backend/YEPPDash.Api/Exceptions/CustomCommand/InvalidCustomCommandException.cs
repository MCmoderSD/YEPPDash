namespace YEPPDash.Api.Exceptions.CustomCommand;

public sealed class InvalidCustomCommandException(string reason) : Exception(reason);