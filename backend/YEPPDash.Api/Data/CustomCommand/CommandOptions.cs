using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data.CustomCommand;

[JsonConverter(typeof(JsonStringEnumConverter<CommandResponseType>))]
public enum CommandResponseType
{
    Reply, Mention, Say
}

[JsonConverter(typeof(JsonStringEnumConverter<CommandUserLevel>))]
public enum CommandUserLevel
{
    Everyone, Follower, Vip, Editor, Moderator, Broadcaster
}