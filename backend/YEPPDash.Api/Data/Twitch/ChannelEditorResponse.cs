namespace YEPPDash.Api.Data.Twitch;

public sealed record ChannelEditorResponse(string Id, string DisplayName, DateTimeOffset CreatedAt)
{
    public static ChannelEditorResponse From(TwitchChannelEditor editor)
    {
        return new ChannelEditorResponse(editor.UserId, editor.UserName, editor.CreatedAt);
    }
}