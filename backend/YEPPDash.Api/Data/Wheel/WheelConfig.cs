namespace YEPPDash.Api.Data.Wheel;

public sealed record WheelEntry(string Label, int Count)
{
    public static IReadOnlyList<WheelEntry> Merge(IEnumerable<WheelEntry> entries)
    {
        var order = new List<WheelEntry>();
        var seen = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var entry in entries)
        {
            var label = entry.Label.Trim();

            if (label.Length is 0) continue;

            var count = Math.Max(1, entry.Count);

            if (seen.TryGetValue(label, out var at))
            {
                order[at] = order[at] with { Count = order[at].Count + count };
                continue;
            }

            seen[label] = order.Count;
            order.Add(new WheelEntry(label, count));
        }

        return order;
    }
}

public sealed record WheelConfig(
    Guid Id,
    int ChannelId,
    string Name,
    DateTime UpdatedAt
);