namespace YEPPDash.Api.Data.Queue;

public sealed record QueueResponse(
    bool IsOpen,
    QueueRequirement Requirement,
    IReadOnlyList<string> Entries
) {
    public static QueueResponse From(QueueState state)
    {
        return new QueueResponse(state.IsOpen, state.Requirement, state.Entries);
    }
}
