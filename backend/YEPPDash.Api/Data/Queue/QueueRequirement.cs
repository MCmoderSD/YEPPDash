using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data.Queue;

[JsonConverter(typeof(JsonStringEnumConverter<QueueRequirement>))]
public enum QueueRequirement
{
    Everyone, Follower, Subscriber, Vip
}
