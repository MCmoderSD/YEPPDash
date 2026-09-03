using System.Text.Json;
using YEPPDash.Api.Data.Giveaway;

using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Services;

public static class GiveawayEvents
{
    public static string OverlayState(GiveawayOverlayState state)
    {
        return JsonSerializer.Serialize(new { type = "state", giveaway = state }, StreamJson.Options);
    }

    public static string OverlaySpin(Guid giveawayId, int index)
    {
        return JsonSerializer.Serialize(new { type = "spin", giveawayId, index }, StreamJson.Options);
    }

    public static string OverlayDismiss(Guid giveawayId)
    {
        return JsonSerializer.Serialize(new { type = "dismiss", giveawayId }, StreamJson.Options);
    }

    public static string Participant(Guid giveawayId, GiveawayParticipantResponse participant)
    {
        return JsonSerializer.Serialize(new { type = "participant", giveawayId, participant }, StreamJson.Options);
    }

    public static string Status(Guid giveawayId, GiveawayStatus status)
    {
        return JsonSerializer.Serialize(new { type = "status", giveawayId, status }, StreamJson.Options);
    }

    public static string Winner(Guid giveawayId, GiveawayWinnerResponse winner)
    {
        return JsonSerializer.Serialize(new { type = "winner", giveawayId, winner }, StreamJson.Options);
    }
}