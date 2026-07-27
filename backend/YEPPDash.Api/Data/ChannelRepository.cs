using Dapper;
using MySqlConnector;
using YEPPDash.Api.Contracts;

namespace YEPPDash.Api.Data;

public sealed class ChannelRepository(MySqlConnection connection) : IChannelRepository
{
    public async Task<IReadOnlyList<ChannelSummary>> GetSampleAsync(int take = 5)
    {
        await connection.OpenAsync();

        var rows = await connection.QueryAsync<ChannelSummary>(
            "SELECT id, active, autoShoutout FROM Channel LIMIT @Take", new { Take = take });

        return rows.AsList();
    }
}
