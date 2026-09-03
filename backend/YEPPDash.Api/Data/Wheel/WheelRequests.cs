namespace YEPPDash.Api.Data.Wheel;

public sealed record WheelEntryUpdate
{
    public string? Label { get; init; }

    public int Count { get; init; } = 1;
}

public sealed record WheelUpdate
{
    public string? Name { get; init; }

    public IReadOnlyList<WheelEntryUpdate> Entries { get; init; } = [];
}

public sealed record WheelSpinRequest
{
    public int Index { get; init; }
}