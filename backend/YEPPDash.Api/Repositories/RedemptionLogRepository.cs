using Dapper;
using YEPPDash.Api.Data.Redemption;

namespace YEPPDash.Api.Repositories;

public sealed class RedemptionLogRepository(YeppDashConnectionFactory connections)
{
    public const string CreateTableSql =
        """
        CREATE TABLE IF NOT EXISTS RedemptionLog
        (
            eventId    VARCHAR(64)  NOT NULL PRIMARY KEY,
            channelId  INT          NOT NULL,
            rewardId   VARCHAR(64)  NOT NULL,
            userId     VARCHAR(64)  NOT NULL,
            input      VARCHAR(500) NOT NULL DEFAULT (''),
            redeemedAt DATETIME(3)  NOT NULL,
            status     VARCHAR(16)  NOT NULL DEFAULT ('UNFULFILLED'),
            reason     VARCHAR(200) NOT NULL DEFAULT (''),
            INDEX ix_RedemptionLog_channel (channelId, redeemedAt),
            INDEX ix_RedemptionLog_reward (rewardId, redeemedAt)
        )
        """;

    public async Task<bool> TryRecordAsync(RedemptionRecord record, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var written = await connection.ExecuteAsync(
            new CommandDefinition(
                """
                INSERT IGNORE INTO RedemptionLog (eventId, channelId, rewardId, userId, input, redeemedAt, status, reason)
                VALUES (@EventId, @ChannelId, @RewardId, @UserId, @input, @RedeemedAt, @Status, @reason)
                """,
                new
                {
                    record.EventId,
                    record.ChannelId,
                    record.RewardId,
                    record.UserId,
                    input = Trim(record.Input, 500),
                    record.RedeemedAt,
                    record.Status,
                    reason = Trim(record.Reason, 200),
                },
                cancellationToken: cancellationToken));

        return written is 1;
    }

    public async Task MarkAsync(string eventId, string status, string reason, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE RedemptionLog SET status = @status, reason = @reason WHERE eventId = @eventId",
                new { eventId, status, reason = Trim(reason, 200) },
                cancellationToken: cancellationToken));
    }

    public async Task<bool> HasAsync(string eventId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        return await connection.ExecuteScalarAsync<int?>(
            new CommandDefinition(
                "SELECT 1 FROM RedemptionLog WHERE eventId = @eventId",
                new { eventId },
                cancellationToken: cancellationToken)) is not null;
    }

    private static string Trim(string value, int limit)
    {
        return value.Length <= limit ? value : value[..limit];
    }
}