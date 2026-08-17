using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data.Shoutout;

namespace YEPPDash.Api.Repositories;

// YEPPBot owns the Channel table and fills it when a channel is added to the bot, so nothing here
// inserts. A channel without a row is one the bot does not know yet — absent rather than a channel
// with the shoutout switched off.
public sealed class ShoutoutRepository(MySqlConnection connection)
{
    public async Task<ShoutoutSettings?> GetAsync(int channelId, CancellationToken cancellationToken)
    {
        var row = await connection.QuerySingleOrDefaultAsync<ChannelRow>(
            new CommandDefinition(
                "SELECT id, autoShoutout FROM Channel WHERE id = @channelId",
                new { channelId },
                cancellationToken: cancellationToken)
            );

        return row is null ? null : new ShoutoutSettings(row.Id, row.AutoShoutout);
    }

    public async Task<ShoutoutSettings?> SetAutoShoutoutAsync(int channelId, bool autoShoutout, CancellationToken cancellationToken)
    {
        await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE Channel SET autoShoutout = @autoShoutout WHERE id = @channelId",
                new { channelId, autoShoutout },
                cancellationToken: cancellationToken)
            );

        // Read back rather than trust the affected count: writing the value the row already held
        // touches no rows, which looks exactly like the row not being there.
        return await GetAsync(channelId, cancellationToken);
    }

    private sealed class ChannelRow
    {
        public int Id { get; init; }
        public bool AutoShoutout { get; init; }
    }
}