namespace YEPPDash.Api.Data.Queue;

public sealed record QueueRequirementRequest
{
    public QueueRequirement Requirement { get; init; }
}

public sealed record QueuePositionRequest
{
    public int Position { get; init; }
}