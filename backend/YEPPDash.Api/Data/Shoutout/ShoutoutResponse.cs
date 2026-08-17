using System.Globalization;

namespace YEPPDash.Api.Data.Shoutout;

public sealed record ShoutoutResponse(
    string ChannelId,
    bool AutoShoutout
) {
    public static ShoutoutResponse From(ShoutoutSettings settings)
    {
        return new ShoutoutResponse(
            settings.ChannelId.ToString(CultureInfo.InvariantCulture),
            settings.AutoShoutout);
    }
}