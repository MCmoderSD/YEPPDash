namespace YEPPDash.Api.Data.Queue;

public static class QueueLimits
{
    // A sanity guard rather than a policy: it is there so a stuck client or a runaway script
    // cannot grow the column until it no longer fits, not to tell anyone how long a queue may be.
    public const int MaxEntries = 500;

    public const char Separator = ',';
}
