using YEPPDash.Api.Data.Twitch;

namespace YEPPDash.Api.Repositories;

public interface ITwitchTokenStore
{
    Task<StoredTwitchToken?> GetAsync(string twitchUserId, CancellationToken cancellationToken);

    Task SaveAsync(StoredTwitchToken token, CancellationToken cancellationToken);

    Task DeleteAsync(string twitchUserId, CancellationToken cancellationToken);
}