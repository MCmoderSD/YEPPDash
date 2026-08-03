namespace YEPPDash.Api.Data.Wheel;

public sealed record WheelResponse(IReadOnlyList<string> Entries, WheelType Type)
{
    public static WheelResponse From(Wheel wheel)
    {
        return new WheelResponse(wheel.Entries, wheel.Type);
    }
}
