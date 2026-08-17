namespace YEPPDash.Api.Data.Shoutout;

public sealed record ShoutoutSettings(
    int ChannelId,
    bool Active,
    bool AutoShoutout
);