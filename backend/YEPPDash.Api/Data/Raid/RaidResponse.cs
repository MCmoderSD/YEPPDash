using YEPPDash.Api.Data.Twitch;

namespace YEPPDash.Api.Data.Raid;

public sealed record RaidResponse(
    string Id,
    TwitchUser Raider,
    int Viewers,
    DateTimeOffset FiredAt
) {
    public static RaidResponse From(RaidEvent raid, TwitchUser raider)
    {
        return new RaidResponse(raid.Id.ToString(), raider, raid.Viewers, raid.FiredAt);
    }
}