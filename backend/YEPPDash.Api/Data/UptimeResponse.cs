namespace YEPPDash.Api.Data;

public sealed record UptimeResponse(DateTimeOffset StartedAt, double UptimeSeconds, string Uptime);
