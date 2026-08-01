using System.Net.Http.Headers;
using System.Text.Json;

namespace YEPPDash.Api.Bot;

public sealed class YeppBotClient(HttpClient httpClient, YeppBotOptions options, ILogger<YeppBotClient> logger)
{
    public bool Configured => options.Configured;

    public Task<YeppBotResult> JoinChannelAsync(string userId, CancellationToken cancellationToken)
    {
        return PostAsync("JoinChannel", userId, cancellationToken);
    }

    public Task<YeppBotResult> LeaveChannelAsync(string userId, CancellationToken cancellationToken)
    {
        return PostAsync("LeaveChannel", userId, cancellationToken);
    }

    /// <summary>
    /// Tells the bot its copy of the channel's custom commands is stale. The bot reloads
    /// asynchronously, so a success here means the reload was started, not that it has finished.
    /// </summary>
    public Task<YeppBotResult> UpdateCustomCommandsAsync(string userId, CancellationToken cancellationToken)
    {
        return PostAsync("UpdateCustomCommands", userId, cancellationToken);
    }

    private async Task<YeppBotResult> PostAsync(string endpoint, string userId, CancellationToken cancellationToken)
    {
        if (!options.Configured) return YeppBotResult.NotConfigured;

        // The bot answers 400 for anything that is not a positive integer, so a bad id is worth
        // catching here rather than spending a request on.
        if (!long.TryParse(userId, out var channelId) || channelId <= 0)
        {
            return YeppBotResult.Failed($"'{userId}' is not a Twitch user id.");
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{endpoint}/{channelId}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);

            using var response = await httpClient.SendAsync(request, cancellationToken);

            var payload = await ReadAsync(response, cancellationToken);
            var status = payload?.Status ?? (int)response.StatusCode;
            var success = payload?.Success ?? response.IsSuccessStatusCode;
            var message = payload?.Message ?? response.ReasonPhrase ?? "The bot did not say what went wrong.";

            if (!success)
            {
                logger.LogWarning(
                    "YEPPBot refused {Endpoint} for channel {ChannelId}: {Status} {Message}",
                    endpoint, channelId, status, message);
            }

            return new YeppBotResult(success, status, message);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            // A cancelled request is the caller giving up, not the bot failing — that has to travel.
            if (cancellationToken.IsCancellationRequested) throw;

            logger.LogWarning(
                exception, "Could not reach YEPPBot for {Endpoint} on channel {ChannelId}", endpoint, channelId);

            return YeppBotResult.Failed("Could not reach YEPPBot.");
        }
    }

    private async Task<YeppBotPayload?> ReadAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<YeppBotPayload>(cancellationToken);
        }
        // An HTML error page from a proxy in front of the bot is not worth failing over — the status
        // line still says enough.
        catch (Exception exception) when (exception is JsonException or NotSupportedException)
        {
            logger.LogDebug(exception, "YEPPBot answered with a body that is not its usual JSON");
            return null;
        }
    }
}
