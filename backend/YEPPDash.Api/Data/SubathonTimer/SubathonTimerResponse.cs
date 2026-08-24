namespace YEPPDash.Api.Data.SubathonTimer;

public sealed record SubathonTimerResponse(
    bool Running,
    DateTime? EndsAt,
    int Remaining,
    int StartSeconds,
    string Style,
    DateTime ServerNow
) {
    public static SubathonTimerResponse From(SubathonTimerState state, DateTime serverNow)
    {
        return new SubathonTimerResponse(
            state.Running, state.EndsAt, state.Remaining, state.StartSeconds, state.Style, serverNow);
    }
}