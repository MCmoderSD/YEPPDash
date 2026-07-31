using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data;

/// <summary>
/// How YEPPBot puts the message in chat. Serialized by name rather than by number, so the stored
/// value still reads for itself if the list is ever reordered.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<CommandResponseType>))]
public enum CommandResponseType
{
    /// <summary>Answers the message that ran the command, hung under it. The default.</summary>
    Reply,

    /// <summary>Says the message with the caller's name in front of it.</summary>
    Mention,

    /// <summary>Says the message on its own, addressed to nobody.</summary>
    Say,
}

/// <summary>
/// The lowest rank allowed to run the command. Anybody above it may run it too, so
/// <see cref="Everyone"/> lets the whole chat and <see cref="Broadcaster"/> only the channel owner.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<CommandUserLevel>))]
public enum CommandUserLevel
{
    Everyone,
    Follower,
    Vip,
    Editor,
    Moderator,
    Broadcaster,
}
