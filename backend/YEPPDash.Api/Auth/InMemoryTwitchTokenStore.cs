using System.Collections.Concurrent;

namespace YEPPDash.Api.Auth;


public sealed class InMemoryTwitchTokenStore : ITwitchTokenStore
{
    private readonly ConcurrentDictionary<string, StoredTwitchToken> _tokens = new();

    public Task<StoredTwitchToken?> GetAsync(string twitchUserId, CancellationToken cancellationToken)
    {
        _tokens.TryGetValue(twitchUserId, out var token);
        return Task.FromResult(token);
    }

    public Task SaveAsync(StoredTwitchToken token, CancellationToken cancellationToken)
    {
        _tokens[token.TwitchUserId] = token;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string twitchUserId, CancellationToken cancellationToken)
    {
        _tokens.TryRemove(twitchUserId, out _);
        return Task.CompletedTask;
    }
}
