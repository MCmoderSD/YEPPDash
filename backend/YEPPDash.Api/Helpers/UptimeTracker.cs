namespace YEPPDash.Api.Helpers;

// Registered as an already-constructed singleton so the clock starts at startup rather than
// whenever something first asks for it.
public sealed class UptimeTracker
{
    // Wall-clock time answers "since when", but it jumps when the host clock is corrected or the
    // machine resumes. The monotonic tick count is what the duration is actually measured from.
    private readonly long _startedTicks = Environment.TickCount64;

    public DateTimeOffset StartedAt { get; } = DateTimeOffset.UtcNow;

    public TimeSpan Elapsed => TimeSpan.FromMilliseconds(Environment.TickCount64 - _startedTicks);
}
