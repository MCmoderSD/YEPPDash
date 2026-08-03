namespace YEPPDash.Api.Data.Wheel;

public sealed record WheelRequest
{
    // Sent in the order the dashboard lists them, one element per copy: a name that is on the wheel
    // twice appears twice, because a flat list is all the column can hold.
    public IReadOnlyList<string> Entries { get; init; } = [];

    public WheelType Type { get; init; } = WheelType.Wheel;
}

public sealed record WheelSpinRequest
{
    // Which slice the wheel is to stop on, counted along the wheel as it is drawn.
    public int Index { get; init; }
}
