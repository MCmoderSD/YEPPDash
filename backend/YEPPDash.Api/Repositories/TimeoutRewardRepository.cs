using Dapper;
using YEPPDash.Api.Data.TimeoutReward;

namespace YEPPDash.Api.Repositories;

public sealed class TimeoutRewardRepository(YeppDashConnectionFactory connections)
{
    public const string CreateTableSql = """
        CREATE TABLE IF NOT EXISTS TimeoutReward
        (
            id                  INT          NOT NULL PRIMARY KEY,
            rewardId            VARCHAR(64)  NOT NULL,
            title               VARCHAR(45)  NOT NULL DEFAULT (''),
            description         VARCHAR(200) NOT NULL DEFAULT (''),
            cost                BIGINT       NOT NULL DEFAULT (1),
            durationSeconds     INT          NOT NULL,
            cooldownSeconds     BIGINT       NULL,
            maxPerStream        BIGINT       NULL,
            maxPerUserPerStream BIGINT       NULL,
            protectEditor       BOOLEAN      NOT NULL DEFAULT (FALSE),
            protectModerator    BOOLEAN      NOT NULL DEFAULT (FALSE),
            protectVip          BOOLEAN      NOT NULL DEFAULT (FALSE),
            protectTier3        BOOLEAN      NOT NULL DEFAULT (FALSE),
            protectTier2        BOOLEAN      NOT NULL DEFAULT (FALSE),
            protectTier1        BOOLEAN      NOT NULL DEFAULT (FALSE),
            protectFollower     BOOLEAN      NOT NULL DEFAULT (FALSE)
        );
        CREATE TABLE IF NOT EXISTS RoleRestore
        (
            channelId INT         NOT NULL,
            userId    VARCHAR(64) NOT NULL,
            role      VARCHAR(16) NOT NULL,
            restoreAt DATETIME(3) NOT NULL,
            attempts  INT         NOT NULL DEFAULT (0),
            PRIMARY KEY (channelId, userId, role)
        )
        """;

    private const string Columns =
        "id, rewardId, title, description, cost, durationSeconds, cooldownSeconds, maxPerStream, maxPerUserPerStream, " +
        "protectEditor, protectModerator, protectVip, protectTier3, protectTier2, protectTier1, protectFollower";

    public async Task<TimeoutRewardConfig?> GetAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var row = await connection.QuerySingleOrDefaultAsync<ConfigRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM TimeoutReward WHERE id = @channelId",
                new { channelId },
                cancellationToken: cancellationToken));

        return row?.ToConfig();
    }

    public async Task<IReadOnlyList<TimeoutRewardConfig>> GetAllAsync(CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<ConfigRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM TimeoutReward",
                cancellationToken: cancellationToken));

        return [.. rows.Select(row => row.ToConfig())];
    }

    public async Task SetAsync(TimeoutRewardConfig config, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                INSERT INTO TimeoutReward
                    (id, rewardId, title, description, cost, durationSeconds, cooldownSeconds, maxPerStream, maxPerUserPerStream,
                     protectEditor, protectModerator, protectVip, protectTier3, protectTier2, protectTier1, protectFollower)
                VALUES
                    (@ChannelId, @RewardId, @Title, @Description, @Cost, @DurationSeconds, @CooldownSeconds, @MaxPerStream, @MaxPerUserPerStream,
                     @editor, @moderator, @vip, @tier3, @tier2, @tier1, @follower)
                ON DUPLICATE KEY UPDATE
                    rewardId            = @RewardId,
                    title               = @Title,
                    description         = @Description,
                    cost                = @Cost,
                    durationSeconds     = @DurationSeconds,
                    cooldownSeconds     = @CooldownSeconds,
                    maxPerStream        = @MaxPerStream,
                    maxPerUserPerStream = @MaxPerUserPerStream,
                    protectEditor       = @editor,
                    protectModerator    = @moderator,
                    protectVip          = @vip,
                    protectTier3        = @tier3,
                    protectTier2        = @tier2,
                    protectTier1        = @tier1,
                    protectFollower     = @follower
                """,
                new
                {
                    config.ChannelId,
                    config.RewardId,
                    config.Title,
                    config.Description,
                    config.Cost,
                    config.DurationSeconds,
                    config.CooldownSeconds,
                    config.MaxPerStream,
                    config.MaxPerUserPerStream,
                    editor = config.Protected.Contains(ProtectedRole.Editor),
                    moderator = config.Protected.Contains(ProtectedRole.Moderator),
                    vip = config.Protected.Contains(ProtectedRole.Vip),
                    tier3 = config.Protected.Contains(ProtectedRole.Tier3Subscriber),
                    tier2 = config.Protected.Contains(ProtectedRole.Tier2Subscriber),
                    tier1 = config.Protected.Contains(ProtectedRole.Subscriber),
                    follower = config.Protected.Contains(ProtectedRole.Follower),
                },
                cancellationToken: cancellationToken));
    }

    public async Task DeleteAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM TimeoutReward WHERE id = @channelId",
                new { channelId },
                cancellationToken: cancellationToken));
    }

    public async Task ScheduleRestoreAsync(RoleRestore restore, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                INSERT INTO RoleRestore (channelId, userId, role, restoreAt, attempts)
                VALUES (@ChannelId, @UserId, @role, @RestoreAt, @Attempts)
                ON DUPLICATE KEY UPDATE restoreAt = @RestoreAt, attempts = @Attempts
                """,
                new { restore.ChannelId, restore.UserId, role = restore.Role.ToString(), restore.RestoreAt, restore.Attempts },
                cancellationToken: cancellationToken));
    }

    public async Task<IReadOnlyList<RoleRestore>> GetDueRestoresAsync(DateTime now, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<RestoreRow>(
            new CommandDefinition(
                "SELECT channelId, userId, role, restoreAt, attempts FROM RoleRestore WHERE restoreAt <= @now",
                new { now },
                cancellationToken: cancellationToken));

        return [.. rows.Select(row => row.ToRestore())];
    }

    public async Task DeleteRestoreAsync(RoleRestore restore, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM RoleRestore WHERE channelId = @ChannelId AND userId = @UserId AND role = @role",
                new { restore.ChannelId, restore.UserId, role = restore.Role.ToString() },
                cancellationToken: cancellationToken));
    }

    private sealed class ConfigRow
    {
        public int Id { get; init; }
        public string RewardId { get; init; } = "";
        public string Title { get; init; } = "";
        public string Description { get; init; } = "";
        public long Cost { get; init; }
        public int DurationSeconds { get; init; }
        public long? CooldownSeconds { get; init; }
        public long? MaxPerStream { get; init; }
        public long? MaxPerUserPerStream { get; init; }
        public bool ProtectEditor { get; init; }
        public bool ProtectModerator { get; init; }
        public bool ProtectVip { get; init; }
        public bool ProtectTier3 { get; init; }
        public bool ProtectTier2 { get; init; }
        public bool ProtectTier1 { get; init; }
        public bool ProtectFollower { get; init; }

        public TimeoutRewardConfig ToConfig()
        {
            HashSet<ProtectedRole> roles = [];

            if (ProtectEditor) roles.Add(ProtectedRole.Editor);
            if (ProtectModerator) roles.Add(ProtectedRole.Moderator);
            if (ProtectVip) roles.Add(ProtectedRole.Vip);
            if (ProtectTier3) roles.Add(ProtectedRole.Tier3Subscriber);
            if (ProtectTier2) roles.Add(ProtectedRole.Tier2Subscriber);
            if (ProtectTier1) roles.Add(ProtectedRole.Subscriber);
            if (ProtectFollower) roles.Add(ProtectedRole.Follower);

            return new TimeoutRewardConfig(
                Id, RewardId, Title, Description, Cost, DurationSeconds,
                CooldownSeconds, MaxPerStream, MaxPerUserPerStream, roles);
        }
    }

    private sealed class RestoreRow
    {
        public int ChannelId { get; init; }
        public string UserId { get; init; } = "";
        public string Role { get; init; } = "";
        public DateTime RestoreAt { get; init; }
        public int Attempts { get; init; }

        public RoleRestore ToRestore()
        {
            return new RoleRestore(
                ChannelId,
                UserId,
                Enum.TryParse<RestorableRole>(Role, out var role) ? role : RestorableRole.Vip,
                RestoreAt,
                Attempts);
        }
    }
}