using System.Text;
using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Helpers;

public static class ServerSentEvents
{
    private static readonly TimeSpan KeepAlive = TimeSpan.FromSeconds(20);

    public static async Task StreamAsync(
        this HttpResponse response, StreamSubscription subscription, CancellationToken cancellationToken)
    {
        response.ContentType = "text/event-stream";
        response.Headers.CacheControl = "no-cache, no-store";
        response.Headers["X-Accel-Buffering"] = "no";

        await WriteAsync(response, ": connected\n\n", cancellationToken);

        while (!cancellationToken.IsCancellationRequested)
        {
            string payload;

            try
            {
                using var idle = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                idle.CancelAfter(KeepAlive);

                payload = await subscription.Reader.ReadAsync(idle.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                await WriteAsync(response, ": keep-alive\n\n", cancellationToken);
                continue;
            }
            catch (OperationCanceledException)
            {
                break;
            }

            await WriteAsync(response, $"data: {payload}\n\n", cancellationToken);
        }
    }

    private static async Task WriteAsync(HttpResponse response, string text, CancellationToken cancellationToken)
    {
        await response.Body.WriteAsync(Encoding.UTF8.GetBytes(text), cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }
}