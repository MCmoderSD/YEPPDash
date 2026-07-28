namespace YEPPDash.Api.Contracts;

public sealed record UserInfo(
    string? TwitchId, 
    string? Login, 
    string? Email
);