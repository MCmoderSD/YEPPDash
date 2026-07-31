namespace YEPPDash.Api.Exceptions.CustomCommand;

public sealed class UnknownCustomCommandChannelException(int channelId, Exception inner) : Exception($"Channel {channelId} is not known to YEPPBot.", inner);