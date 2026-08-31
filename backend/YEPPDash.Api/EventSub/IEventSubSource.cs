using System.Text.Json;

namespace YEPPDash.Api.EventSub;

public interface IEventSubSource
{
    Task<IReadOnlyDictionary<int, IReadOnlyList<EventSubRequest>>> RequestsAsync(CancellationToken cancellationToken);
    
    Task CatchUpAsync(int channelId, CancellationToken cancellationToken);

    Task HandleAsync(int channelId, string type, JsonElement body, CancellationToken cancellationToken);
}