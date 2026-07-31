namespace YEPPDash.Api.Exceptions.Birthday;

public sealed class UnknownBirthdayUserException(int userId, Exception inner) : Exception($"User {userId} is not known to YEPPBot.", inner);