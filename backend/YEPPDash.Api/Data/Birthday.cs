namespace YEPPDash.Api.Data;

/// <summary>
/// A user's date of birth as stored in YEPPBot's database. <paramref name="UserId"/> is the Twitch
/// user id, which is also the table's primary key — a user has at most one birthday.
/// </summary>
/// <remarks>
/// Kept as three numbers rather than a <see cref="DateOnly"/> on purpose. The table's CHECK
/// constraints cap the day at 31 without regard for the month, so a row written by something other
/// than this API can hold the 30th of February; reading has to stay possible even then.
/// </remarks>
public sealed record Birthday(int UserId, int Day, int Month, int Year);
