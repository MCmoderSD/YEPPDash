namespace YEPPDash.Api.Data.Queue;

public sealed record QueueState(
    int ChannelId,
    bool IsOpen,
    QueueRequirement Requirement,
    IReadOnlyList<string> Entries,
    DateTime UpdatedAt
);
