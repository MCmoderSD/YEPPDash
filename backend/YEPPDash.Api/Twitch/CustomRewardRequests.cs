using System.Net;
using YEPPDash.Api.Data.Twitch;
using YEPPDash.Api.Exceptions.Twitch;
using YEPPDash.Api.Services;

namespace YEPPDash.Api.Twitch;

public static class CustomRewardRequests
{
    public sealed record Fields(
        string Title,
        long Cost,
        string Prompt,
        string? BackgroundColor,
        bool Enabled,
        bool UserInputRequired,
        long? CooldownSeconds,
        long? MaxPerStream,
        long? MaxPerUserPerStream);

    public static CustomRewardCreate Create(Fields fields)
    {
        return new CustomRewardCreate
        {
            Title = fields.Title,
            Cost = fields.Cost,
            Prompt = fields.Prompt,
            BackgroundColor = fields.BackgroundColor,
            IsEnabled = fields.Enabled,

            IsUserInputRequired = fields.UserInputRequired,
            ShouldRedemptionsSkipRequestQueue = false,

            IsGlobalCooldownEnabled = fields.CooldownSeconds > 0,
            GlobalCooldownSeconds = fields.CooldownSeconds > 0 ? fields.CooldownSeconds : null,
            IsMaxPerStreamEnabled = fields.MaxPerStream > 0,
            MaxPerStream = fields.MaxPerStream > 0 ? fields.MaxPerStream : null,
            IsMaxPerUserPerStreamEnabled = fields.MaxPerUserPerStream > 0,
            MaxPerUserPerStream = fields.MaxPerUserPerStream > 0 ? fields.MaxPerUserPerStream : null,
        };
    }

    public static CustomRewardUpdate Update(Fields fields)
    {
        return new CustomRewardUpdate
        {
            Title = fields.Title,
            Cost = fields.Cost,
            Prompt = fields.Prompt,
            BackgroundColor = fields.BackgroundColor,
            IsEnabled = fields.Enabled,

            IsUserInputRequired = fields.UserInputRequired,
            ShouldRedemptionsSkipRequestQueue = false,

            IsGlobalCooldownEnabled = fields.CooldownSeconds > 0,
            GlobalCooldownSeconds = fields.CooldownSeconds > 0 ? fields.CooldownSeconds : null,
            IsMaxPerStreamEnabled = fields.MaxPerStream > 0,
            MaxPerStream = fields.MaxPerStream > 0 ? fields.MaxPerStream : null,
            IsMaxPerUserPerStreamEnabled = fields.MaxPerUserPerStream > 0,
            MaxPerUserPerStream = fields.MaxPerUserPerStream > 0 ? fields.MaxPerUserPerStream : null,
        };
    }

    // Every other field is left out, so Helix keeps what it already has: opening or closing a
    // giveaway must not quietly reset a title or a limit the streamer changed on Twitch's own page.
    public static CustomRewardUpdate SetEnabled(bool enabled)
    {
        return new CustomRewardUpdate { IsEnabled = enabled };
    }

    public static string PromptOrDefault(string? prompt, string fallback)
    {
        return string.IsNullOrWhiteSpace(prompt) ? fallback : prompt;
    }

    public static bool IsNotFound(this TwitchOAuthException exception)
    {
        return exception.StatusCode is HttpStatusCode.NotFound;
    }

    public static async Task DeleteIfPresentAsync(
        this TwitchChannelService channels, string broadcasterId, string rewardId, CancellationToken cancellationToken)
    {
        try
        {
            await channels.DeleteCustomRewardAsync(broadcasterId, rewardId, cancellationToken);
        }
        catch (TwitchOAuthException exception) when (exception.IsNotFound())
        {
        }
    }
}