namespace YEPPDash.Api.Exceptions.Wheel;

public sealed class InvalidWheelException(string reason) : Exception(reason);