using System.Text.Json.Serialization;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Data.Twitch;

public sealed record TwitchChatColor
{
    public required string UserId { get; init; }
    public required string UserLogin { get; init; }
    public required string UserName { get; init; }
    
    [JsonConverter(typeof(EmptyStringToNullConverter))]
    public required string? Color { get; init; }
}