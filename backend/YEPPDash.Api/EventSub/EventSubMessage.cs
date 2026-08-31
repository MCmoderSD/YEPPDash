using System.Text.Json;

namespace YEPPDash.Api.EventSub;

public sealed record EventSubMessage
{
    public EventSubMetadata Metadata { get; init; } = new();

    public EventSubPayload Payload { get; init; } = new();
}

public sealed record EventSubMetadata
{
    public string MessageId { get; init; } = "";

    public string MessageType { get; init; } = "";

    public DateTimeOffset MessageTimestamp { get; init; }

    public string? SubscriptionType { get; init; }
}

public sealed record EventSubPayload
{
    public EventSubSession? Session { get; init; }

    public EventSubSubscription? Subscription { get; init; }

    public JsonElement? Event { get; init; }
}

public sealed record EventSubSession
{
    public string Id { get; init; } = "";

    public string? ReconnectUrl { get; init; }
}

public sealed record EventSubSubscription
{
    public string Type { get; init; } = "";

    public string Status { get; init; } = "";
}