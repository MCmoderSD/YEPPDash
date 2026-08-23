namespace YEPPDash.Api.Data.SubathonTimer;

/// <summary>
/// The one wire shape, used by the dashboard, the overlay and every event pushed to them.
/// </summary>
/// <remarks>
/// <see cref="ServerNow"/> is not decoration. A viewer works out the time left as
/// <c>EndsAt - now</c>, and <c>EndsAt</c> is an instant on this machine's clock — a streaming PC
/// running forty seconds fast would show a subathon forty seconds short forever, and would read
/// 00:00 while the bot still had time on it. Sent alongside, it lets a client measure how far its
/// own clock is off once and render against that instead.
/// </remarks>
public sealed record SubathonTimerResponse(
    bool Running,
    DateTime? EndsAt,
    int Remaining,
    int StartSeconds,
    string Style,
    DateTime ServerNow)
{
    public static SubathonTimerResponse From(SubathonTimerState state, DateTime serverNow)
    {
        return new SubathonTimerResponse(
            state.Running, state.EndsAt, state.Remaining, state.StartSeconds, state.Style, serverNow);
    }
}
