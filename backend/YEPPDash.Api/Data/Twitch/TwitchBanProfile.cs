using System.Diagnostics.CodeAnalysis;

namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchBanProfile : TwitchUser
{
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

public sealed record BanStatusResponse(bool Banned, TwitchBanProfile? Ban);