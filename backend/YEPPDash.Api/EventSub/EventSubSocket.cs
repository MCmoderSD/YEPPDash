using System.Net.WebSockets;
using System.Text.Json;
using YEPPDash.Api.Twitch;

namespace YEPPDash.Api.EventSub;

public sealed class EventSubSocket(
    IServiceScopeFactory scopeFactory,
    ILogger<EventSubSocket> logger
) {

    private const string Welcome = "session_welcome";
    private const string Keepalive = "session_keepalive";
    private const string Notification = "notification";
    private const string Reconnect = "session_reconnect";
    private const string Revocation = "revocation";

    private const string SocketUrl = "wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=10";

    private static readonly TimeSpan Silence = TimeSpan.FromSeconds(15);

    public async Task RunAsync(
        string broadcasterId,
        string accessToken,
        IReadOnlyList<EventSubRequest> requests,
        Func<CancellationToken, Task> onReady,
        Func<EventSubMessage, CancellationToken, Task> onNotification,
        CancellationToken cancellationToken)
    {
        var socket = await OpenAsync(SocketUrl, cancellationToken);

        try
        {
            var subscribed = false;

            while (!cancellationToken.IsCancellationRequested)
            {
                var message = await ReceiveAsync(socket, cancellationToken)
                    ?? throw new InvalidOperationException("Twitch closed the socket.");

                switch (message.Metadata.MessageType)
                {
                    case Welcome:
                        if (!subscribed)
                        {
                            var sessionId = message.Payload.Session?.Id;
                            if (string.IsNullOrEmpty(sessionId)) throw new InvalidOperationException("Twitch said hello without naming a session.");

                            await SubscribeAsync(sessionId, accessToken, requests, cancellationToken);
                            subscribed = true;

                            logger.LogInformation(
                                "EventSub is listening for {Count} subscriptions in channel {BroadcasterId}",
                                requests.Count, broadcasterId);
                        }

                        await onReady(cancellationToken);
                        break;

                    case Keepalive:
                        break;

                    case Notification:
                        await onNotification(message, cancellationToken);
                        break;

                    case Reconnect:
                        socket = await MigrateAsync(socket, message, cancellationToken);
                        await onReady(cancellationToken);
                        break;

                    case Revocation:
                        logger.LogWarning(
                            "Twitch revoked {Type} for channel {BroadcasterId} ({Status})",
                            message.Payload.Subscription?.Type, broadcasterId, message.Payload.Subscription?.Status);
                        return;
                }
            }
        }
        finally
        {
            socket.Dispose();
        }
    }

    private async Task SubscribeAsync(string sessionId, string accessToken, IReadOnlyList<EventSubRequest> requests, CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var apiClient = scope.ServiceProvider.GetRequiredService<TwitchApiClient>();

        foreach (var request in requests)
        {
            await apiClient.CreateEventSubSubscriptionAsync(
                new EventSubSubscriptionCreate
                {
                    Type = request.Type,
                    Version = request.Version,
                    Condition = request.Condition,
                    Transport = new EventSubTransport { Method = "websocket", SessionId = sessionId },
                },
                accessToken,
                cancellationToken);
        }
    }

    private async Task<ClientWebSocket> MigrateAsync(ClientWebSocket current, EventSubMessage message, CancellationToken cancellationToken)
    {
        var url = message.Payload.Session?.ReconnectUrl;
        if (string.IsNullOrEmpty(url)) throw new InvalidOperationException("Twitch asked for a reconnect without naming a URL.");

        var next = await OpenAsync(url, cancellationToken);

        try
        {
            while (true)
            {
                var welcome = await ReceiveAsync(next, cancellationToken);
                if (welcome is null) throw new InvalidOperationException("The reconnect socket closed before it said hello.");

                if (welcome.Metadata.MessageType is Welcome) break;
            }
        }
        catch
        {
            next.Dispose();
            throw;
        }

        current.Dispose();
        return next;
    }

    private static async Task<ClientWebSocket> OpenAsync(string url, CancellationToken cancellationToken)
    {
        var socket = new ClientWebSocket();

        try
        {
            await socket.ConnectAsync(new Uri(url), cancellationToken);
            return socket;
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }

    private static async Task<EventSubMessage?> ReceiveAsync(ClientWebSocket socket, CancellationToken cancellationToken)
    {
        using var quiet = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        quiet.CancelAfter(Silence);

        using var buffer = new MemoryStream();
        var segment = new byte[8192];

        while (true)
        {
            var received = await socket.ReceiveAsync(new ArraySegment<byte>(segment), quiet.Token);
            if (received.MessageType is WebSocketMessageType.Close) return null;

            buffer.Write(segment, 0, received.Count);
            if (received.EndOfMessage) break;
        }

        buffer.Position = 0;
        return await JsonSerializer.DeserializeAsync<EventSubMessage>(buffer, TwitchJson.Options, cancellationToken);
    }
}