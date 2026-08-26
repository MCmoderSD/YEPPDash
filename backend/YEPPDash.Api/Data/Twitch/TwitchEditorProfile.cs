using System.Diagnostics.CodeAnalysis;

namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchEditorProfile : TwitchUser
{
    [SetsRequiredMembers]
    public TwitchEditorProfile(TwitchUser user, DateTimeOffset editorSince) : base(user)
    {
        EditorSince = editorSince;
    }

    public DateTimeOffset EditorSince { get; init; }
}