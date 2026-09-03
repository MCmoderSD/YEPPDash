namespace YEPPDash.Api.Data.Wheel;

public sealed record WheelSummary(
    Guid Id,
    string Name,
    int EntryCount,
    int SliceCount,
    DateTime UpdatedAt
);

public sealed record WheelResponse(
    Guid Id,
    string Name,
    IReadOnlyList<WheelEntry> Entries,
    DateTime UpdatedAt
);

public sealed record WheelOverlayState(
    Guid WheelId,
    string Name,
    IReadOnlyList<WheelEntry> Entries
);

public sealed record WheelOverlayResponse(WheelOverlayState? Wheel);