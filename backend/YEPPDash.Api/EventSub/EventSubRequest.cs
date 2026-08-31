using System.Text.Json.Serialization;

namespace YEPPDash.Api.EventSub;

public sealed record EventSubRequest(string Type, string Version, IReadOnlyDictionary<string, string> Condition)
{
    public string Signature => $"{Type}@{Version}:{string.Join('&', Condition.OrderBy(entry => entry.Key, StringComparer.Ordinal).Select(entry => $"{entry.Key}={entry.Value}"))}";
}

public sealed record EventSubSubscriptionCreate
{
    public required string Type { get; init; }

    public required string Version { get; init; }

    public required IReadOnlyDictionary<string, string> Condition { get; init; }

    public required EventSubTransport Transport { get; init; }
}

public sealed record EventSubTransport
{
    public required string Method { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? SessionId { get; init; }
}