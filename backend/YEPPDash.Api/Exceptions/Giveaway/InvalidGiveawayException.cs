namespace YEPPDash.Api.Exceptions.Giveaway;

public sealed class InvalidGiveawayException(string reason) : Exception(reason);