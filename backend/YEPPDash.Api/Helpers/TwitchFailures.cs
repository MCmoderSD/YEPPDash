using Microsoft.AspNetCore.Mvc;
using YEPPDash.Api.Exceptions.Twitch;

namespace YEPPDash.Api.Helpers;

public static class TwitchFailures
{
    public static IActionResult TwitchFailure(this ControllerBase controller, ILogger logger, Exception exception, string description)
    {
        if (exception is not TwitchOAuthException twitchException)
        {
            logger.LogWarning(exception, "Twitch is unreachable, cannot {Description}", LogSafe.OneLine(description));
            return controller.StatusCode(StatusCodes.Status502BadGateway);
        }

        logger.LogWarning(
            "Twitch refused to {Description} ({StatusCode}): {Body}",
            LogSafe.OneLine(description), twitchException.StatusCode, LogSafe.OneLine(twitchException.ResponseBody));

        if (twitchException.ResponseBody?.Contains("DUPLICATE_REWARD", StringComparison.OrdinalIgnoreCase) == true)
        {
            return controller.BadRequest("A reward with this name already exists in your channel.");
        }

        var status = (int)twitchException.StatusCode;
        return status is >= 400 and < 500
            ? controller.StatusCode(status)
            : controller.StatusCode(StatusCodes.Status502BadGateway);
    }
}