using System.Diagnostics.CodeAnalysis;

namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchBanProfile : TwitchUser
{
    // BannedAt rather than CreatedAt: the base already carries CreatedAt for the account itself.
    [SetsRequiredMembers]
    public TwitchBanProfile(
        TwitchUser user,
        TwitchUser? moderator,
        DateTimeOffset? expiresAt,
        DateTimeOffset bannedAt,
        string? reason) : base(user)
    {
        Moderator = moderator;
        ExpiresAt = expiresAt;
        BannedAt = bannedAt;
        Reason = reason;
    }

    public TwitchUser? Moderator { get; init; }

    public DateTimeOffset? ExpiresAt { get; init; }

    public DateTimeOffset BannedAt { get; init; }

    public string? Reason { get; init; }
}

// Banned stands on its own rather than on Ban: a ban whose account Get Users no longer resolves is
// still a ban, and answering "not banned" there would invite the caller to act on it.
public sealed record BanStatusResponse(bool Banned, TwitchBanProfile? Ban);
