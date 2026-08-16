using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data.Raid;

namespace YEPPDash.Api.Repositories;

public sealed class RaidRepository(MySqlConnection connection)
{
    public async Task<IReadOnlyList<RaidEvent>> GetForChannelAsync(int channelId, CancellationToken cancellationToken)
    {
        var rows = await connection.QueryAsync<RaidRow>(
            new CommandDefinition(
                """
                SELECT id, channelId, userId, viewers, firedAt
                FROM RaidEvent
                WHERE channelId = @channelId
                ORDER BY firedAt DESC, id
                """,
                new { channelId },
                cancellationToken: cancellationToken)
            );

        return [.. rows.Select(ToRaid)];
    }

    private static RaidEvent ToRaid(RaidRow row)
    {
        var firedAt = DateTime.SpecifyKind(row.FiredAt, DateTimeKind.Utc);

        return new RaidEvent(row.Id, row.ChannelId, row.UserId, row.Viewers, firedAt);
    }

    private sealed class RaidRow
    {
        public Guid Id { get; init; }
        public int ChannelId { get; init; }
        public int UserId { get; init; }
        public int Viewers { get; init; }
        public DateTime FiredAt { get; init; }
    }
}