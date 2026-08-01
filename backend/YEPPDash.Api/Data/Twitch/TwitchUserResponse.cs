using System.Diagnostics.CodeAnalysis;

namespace YEPPDash.Api.Data.Twitch;

public record TwitchUserResponse
{
    public required string Id { get; init; }

    public required string Login { get; init; }

    public required string DisplayName { get; init; }

    public required string Type { get; init; }

    public required string BroadcasterType { get; init; }

    public required string Description { get; init; }

    public required string ProfileImageUrl { get; init; }

    public required string? OfflineImageUrl { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    public string? Email { get; init; }

    public string? Color { get; init; }

    public TwitchUserRoles? Roles { get; init; }

    public static TwitchUserResponse From(TwitchUser user)
    {
        return new TwitchUserResponse
        {
            Id = user.Id,
            Login = user.Login,
            DisplayName = user.DisplayName,
            Type = user.Type,
            BroadcasterType = user.BroadcasterType,
            Description = user.Description,
            ProfileImageUrl = user.ProfileImageUrl,
            OfflineImageUrl = user.OfflineImageUrl,
            CreatedAt = user.CreatedAt,
            Email = user.Email,
            Color = user.Color,
            Roles = user.Roles,
        };
    }
}

public sealed record ModeratorResponse : TwitchUserResponse
{
    [SetsRequiredMembers]
    public ModeratorResponse(TwitchUser user) : base(From(user)) { }
}

public sealed record VipResponse : TwitchUserResponse
{
    [SetsRequiredMembers]
    public VipResponse(TwitchUser user) : base(From(user)) { }
}

public sealed record EditorResponse : TwitchUserResponse
{
    [SetsRequiredMembers]
    public EditorResponse(TwitchUser user, DateTimeOffset editorSince) : base(From(user))
    {
        EditorSince = editorSince;
    }

    public DateTimeOffset EditorSince { get; init; }
}

public sealed record FollowerProfileResponse : TwitchUserResponse
{
    [SetsRequiredMembers]
    public FollowerProfileResponse(TwitchUser user, DateTimeOffset followedAt) : base(From(user))
    {
        FollowedAt = followedAt;
    }

    public DateTimeOffset FollowedAt { get; init; }
}
