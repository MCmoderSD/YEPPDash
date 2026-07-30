namespace YEPPDash.Api.Data;

// No login, unlike every other channel user this API returns — Get Channel Editors simply does not
// send one.
public sealed record ChannelEditorResponse(string Id, string DisplayName, DateTimeOffset CreatedAt)
{
    public static ChannelEditorResponse From(TwitchChannelEditor editor)
    {
        return new ChannelEditorResponse(editor.UserId, editor.UserName, editor.CreatedAt);
    }
}
