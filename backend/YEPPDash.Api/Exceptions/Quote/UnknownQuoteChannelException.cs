namespace YEPPDash.Api.Exceptions.Quote;

public sealed class UnknownQuoteChannelException(int channelId, Exception inner) : Exception($"Channel {channelId} is not known to YEPPBot.", inner);