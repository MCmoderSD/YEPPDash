namespace YEPPDash.Api.Exceptions.Queue;

public sealed class InvalidQueueException(string message) : Exception(message);
