namespace YEPPDash.Api.Data.Twitch;

public sealed record UptimeResponse(
    DateTimeOffset StartedAt, 
    double UptimeSeconds, 
    string Uptime
);