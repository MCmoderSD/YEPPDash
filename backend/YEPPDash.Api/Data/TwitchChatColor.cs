using System.Text.Json.Serialization;
using YEPPDash.Api.Helpers;

namespace YEPPDash.Api.Data;

// Mirrors https://dev.twitch.tv/docs/api/reference/#get-user-chat-color — read with
// TwitchJson.Options, which maps Twitch's snake_case onto these names.
public sealed record TwitchChatColor
{
    public required string UserId { get; init; }
    public required string UserLogin { get; init; }
    public required string UserName { get; init; }

    // Twitch sends "" for users who never picked a colour — they get a random one per channel
    // instead, which is not something this API can report.
    [JsonConverter(typeof(EmptyStringToNullConverter))]
    public required string? Color { get; init; }
}
