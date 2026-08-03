namespace YEPPDash.Api.Data.Wheel;

public sealed record WheelRequest
{
    public IReadOnlyList<string> Entries { get; init; } = [];
}

public sealed record WheelSpinRequest
{
    public int Index { get; init; }
}