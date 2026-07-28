using System.Collections.Concurrent;

namespace YEPPDash.Api.Auth;

// Fallback used when no writable YEPPDash connection string is configured. Everything is lost on
// restart, which is fine for local experiments but means the bot never sees a token — the same
// stub-first approach PLAN.md already uses for IBotClient.
public sealed class InMemoryTwitchTokenStore : ITwitchTokenStore
{
    private readonly ConcurrentDictionary<string, StoredTwitchToken> tokens = new();

    public Task<StoredTwitchToken?> GetAsync(string twitchUserId, CancellationToken cancellationToken)
    {
        tokens.TryGetValue(twitchUserId, out var token);
        return Task.FromResult(token);
    }

    public Task SaveAsync(StoredTwitchToken token, CancellationToken cancellationToken)
    {
        tokens[token.TwitchUserId] = token;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string twitchUserId, CancellationToken cancellationToken)
    {
        tokens.TryRemove(twitchUserId, out _);
        return Task.CompletedTask;
    }
}
