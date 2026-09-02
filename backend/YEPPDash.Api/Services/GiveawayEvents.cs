using System.Text.Json;
using YEPPDash.Api.Data.Giveaway;

namespace YEPPDash.Api.Services;

public static class GiveawayEvents
{
    private static readonly JsonSerializerOptions EventJson = new(JsonSerializerDefaults.Web);

    public static string OverlayState(GiveawayOverlayState state)
    {
        return JsonSerializer.Serialize(new { type = "state", giveaway = state }, EventJson);
    }

    public static string OverlaySpin(Guid giveawayId, int index)
    {
        return JsonSerializer.Serialize(new { type = "spin", giveawayId, index }, EventJson);
    }

    public static string OverlayDismiss(Guid giveawayId)
    {
        return JsonSerializer.Serialize(new { type = "dismiss", giveawayId }, EventJson);
    }

    public static string Participant(Guid giveawayId, GiveawayParticipantResponse participant)
    {
        return JsonSerializer.Serialize(new { type = "participant", giveawayId, participant }, EventJson);
    }

    public static string Status(Guid giveawayId, GiveawayStatus status)
    {
        return JsonSerializer.Serialize(new { type = "status", giveawayId, status }, EventJson);
    }

    public static string Winner(Guid giveawayId, GiveawayWinnerResponse winner)
    {
        return JsonSerializer.Serialize(new { type = "winner", giveawayId, winner }, EventJson);
    }
}