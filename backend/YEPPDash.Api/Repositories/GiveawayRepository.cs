using Dapper;
using MySqlConnector;
using YEPPDash.Api.Data.Giveaway;

namespace YEPPDash.Api.Repositories;

public readonly record struct GiveawayCounts(int Participants, int Winners);

public sealed class GiveawayRepository(YeppDashConnectionFactory connections)
{
    private const int DuplicateKey = 1062;

    private const int OrderAttempts = 3;

    public const string CreateTableSql = """
        CREATE TABLE IF NOT EXISTS Giveaway
        (
            id                   CHAR(36)     NOT NULL PRIMARY KEY,
            channelId            INT          NOT NULL,
            rewardId             CHAR(36)     NOT NULL,
            title                VARCHAR(45)  NOT NULL DEFAULT (''),
            description          VARCHAR(200) NOT NULL DEFAULT (''),
            cost                 BIGINT       NOT NULL DEFAULT (1),
            status               ENUM ('Draft', 'Open', 'Closed') NOT NULL DEFAULT ('Draft'),
            updatedAt            DATETIME(3)  NOT NULL,
            cooldownSeconds      BIGINT       NULL,
            maxPerStream         BIGINT       NULL,
            maxPerUserPerStream  BIGINT       NULL,
            requireFollower      BOOLEAN      NOT NULL DEFAULT (FALSE),
            excludeFollower      BOOLEAN      NOT NULL DEFAULT (FALSE),
            requireSubscriber    BOOLEAN      NOT NULL DEFAULT (FALSE),
            excludeSubscriber    BOOLEAN      NOT NULL DEFAULT (FALSE),
            requireTier2         BOOLEAN      NOT NULL DEFAULT (FALSE),
            excludeTier2         BOOLEAN      NOT NULL DEFAULT (FALSE),
            requireTier3         BOOLEAN      NOT NULL DEFAULT (FALSE),
            excludeTier3         BOOLEAN      NOT NULL DEFAULT (FALSE),
            requireVip           BOOLEAN      NOT NULL DEFAULT (FALSE),
            excludeVip           BOOLEAN      NOT NULL DEFAULT (FALSE),
            requireModerator     BOOLEAN      NOT NULL DEFAULT (FALSE),
            excludeModerator     BOOLEAN      NOT NULL DEFAULT (FALSE),
            multiplierBase       DOUBLE       NOT NULL DEFAULT (1),
            multiplierFollower   DOUBLE       NOT NULL DEFAULT (1),
            multiplierSubscriber DOUBLE       NOT NULL DEFAULT (1),
            multiplierTier2      DOUBLE       NOT NULL DEFAULT (1),
            multiplierTier3      DOUBLE       NOT NULL DEFAULT (1),
            multiplierVip        DOUBLE       NOT NULL DEFAULT (1),
            multiplierModerator  DOUBLE       NOT NULL DEFAULT (1),
            INDEX ix_Giveaway_channel (channelId, updatedAt),
            INDEX ix_Giveaway_reward (channelId, rewardId)
        );

        CREATE TABLE IF NOT EXISTS GiveawayParticipant
        (
            giveawayId   CHAR(36)    NOT NULL,
            userId       VARCHAR(64) NOT NULL,
            userName     VARCHAR(64) NOT NULL DEFAULT (''),
            redemptionId CHAR(36)    NOT NULL,
            isFollower   BOOLEAN     NOT NULL DEFAULT (FALSE),
            subTier      ENUM ('None', 'Tier1', 'Tier2', 'Tier3') NOT NULL DEFAULT ('None'),
            isVip        BOOLEAN     NOT NULL DEFAULT (FALSE),
            isModerator  BOOLEAN     NOT NULL DEFAULT (FALSE),
            multiplier   DOUBLE      NOT NULL DEFAULT (1),
            enteredAt    DATETIME(3) NOT NULL,
            PRIMARY KEY (giveawayId, userId),
            INDEX ix_GiveawayParticipant_redemption (redemptionId)
        );

        CREATE TABLE IF NOT EXISTS GiveawayWinner
        (
            giveawayId CHAR(36)    NOT NULL,
            drawOrder  INT         NOT NULL,
            userId     VARCHAR(64) NOT NULL,
            userName   VARCHAR(64) NOT NULL DEFAULT (''),
            multiplier DOUBLE      NOT NULL DEFAULT (1),
            wonAt      DATETIME(3) NOT NULL,
            PRIMARY KEY (giveawayId, drawOrder)
        )
        """;

    private const string Columns =
        "id, channelId, rewardId, title, description, cost, status, updatedAt, " +
        "cooldownSeconds, maxPerStream, maxPerUserPerStream, " +
        "requireFollower, excludeFollower, requireSubscriber, excludeSubscriber, requireTier2, excludeTier2, " +
        "requireTier3, excludeTier3, requireVip, excludeVip, requireModerator, excludeModerator, " +
        "multiplierBase, multiplierFollower, multiplierSubscriber, multiplierTier2, multiplierTier3, multiplierVip, multiplierModerator";

    private const string ParticipantColumns = "giveawayId, userId, userName, redemptionId, isFollower, subTier, isVip, isModerator, multiplier, enteredAt";

    private const string WinnerColumns = "giveawayId, drawOrder, userId, userName, multiplier, wonAt";

    public async Task<GiveawayConfig?> FindAsync(Guid giveawayId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var row = await connection.QuerySingleOrDefaultAsync<ConfigRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM Giveaway WHERE id = @giveawayId",
                new { giveawayId },
                cancellationToken: cancellationToken)
            );

        return row?.ToConfig();
    }

    public async Task<GiveawayConfig?> GetAsync(int channelId, Guid giveawayId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var row = await connection.QuerySingleOrDefaultAsync<ConfigRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM Giveaway WHERE id = @giveawayId AND channelId = @channelId",
                new { channelId, giveawayId },
                cancellationToken: cancellationToken)
            );

        return row?.ToConfig();
    }

    public async Task<GiveawayConfig?> GetByRewardAsync(int channelId, string rewardId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var row = await connection.QuerySingleOrDefaultAsync<ConfigRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM Giveaway WHERE channelId = @channelId AND rewardId = @rewardId",
                new { channelId, rewardId },
                cancellationToken: cancellationToken)
            );

        return row?.ToConfig();
    }

    public async Task<int> CountAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        return await connection.ExecuteScalarAsync<int>(
            new CommandDefinition(
                "SELECT COUNT(*) FROM Giveaway WHERE channelId = @channelId",
                new { channelId },
                cancellationToken: cancellationToken)
            );
    }

    public async Task<IReadOnlyList<GiveawayConfig>> GetChannelAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<ConfigRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM Giveaway WHERE channelId = @channelId ORDER BY updatedAt DESC, id DESC",
                new { channelId },
                cancellationToken: cancellationToken)
            );

        return [.. rows.Select(row => row.ToConfig())];
    }

    public async Task<IReadOnlyList<GiveawayConfig>> GetActiveAsync(CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<ConfigRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM Giveaway WHERE status <> 'Closed'",
                cancellationToken: cancellationToken)
            );

        return [.. rows.Select(row => row.ToConfig())];
    }

    public async Task<IReadOnlyList<GiveawayConfig>> GetActiveChannelAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<ConfigRow>(
            new CommandDefinition(
                $"SELECT {Columns} FROM Giveaway WHERE channelId = @channelId AND status <> 'Closed'",
                new { channelId },
                cancellationToken: cancellationToken)
            );

        return [.. rows.Select(row => row.ToConfig())];
    }

    public async Task InsertAsync(GiveawayConfig config, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                $"""
                INSERT INTO Giveaway ({Columns})
                VALUES
                    (@Id, @ChannelId, @RewardId, @Title, @Description, @Cost, @status, @UpdatedAt,
                     @CooldownSeconds, @MaxPerStream, @MaxPerUserPerStream,
                     @requireFollower, @excludeFollower, @requireSubscriber, @excludeSubscriber,
                     @requireTier2, @excludeTier2, @requireTier3, @excludeTier3,
                     @requireVip, @excludeVip, @requireModerator, @excludeModerator,
                     @multiplierBase, @multiplierFollower, @multiplierSubscriber, @multiplierTier2, @multiplierTier3,
                     @multiplierVip, @multiplierModerator)
                """,
                Parameters(config),
                cancellationToken: cancellationToken)
            );
    }

    public async Task UpdateAsync(GiveawayConfig config, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                UPDATE Giveaway SET
                    rewardId             = @RewardId,
                    title                = @Title,
                    description          = @Description,
                    cost                 = @Cost,
                    updatedAt            = @UpdatedAt,
                    cooldownSeconds      = @CooldownSeconds,
                    maxPerStream         = @MaxPerStream,
                    maxPerUserPerStream  = @MaxPerUserPerStream,
                    requireFollower      = @requireFollower,
                    excludeFollower      = @excludeFollower,
                    requireSubscriber    = @requireSubscriber,
                    excludeSubscriber    = @excludeSubscriber,
                    requireTier2         = @requireTier2,
                    excludeTier2         = @excludeTier2,
                    requireTier3         = @requireTier3,
                    excludeTier3         = @excludeTier3,
                    requireVip           = @requireVip,
                    excludeVip           = @excludeVip,
                    requireModerator     = @requireModerator,
                    excludeModerator     = @excludeModerator,
                    multiplierBase       = @multiplierBase,
                    multiplierFollower   = @multiplierFollower,
                    multiplierSubscriber = @multiplierSubscriber,
                    multiplierTier2      = @multiplierTier2,
                    multiplierTier3      = @multiplierTier3,
                    multiplierVip        = @multiplierVip,
                    multiplierModerator  = @multiplierModerator
                WHERE id = @Id
                """,
                Parameters(config),
                cancellationToken: cancellationToken)
            );
    }

    public async Task SetStatusAsync(Guid giveawayId, GiveawayStatus status, DateTime updatedAt, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE Giveaway SET status = @status, updatedAt = @updatedAt WHERE id = @giveawayId",
                new { giveawayId, status = status.ToString(), updatedAt },
                cancellationToken: cancellationToken)
            );
    }

    public async Task SetRewardAsync(Guid giveawayId, string rewardId, DateTime updatedAt, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE Giveaway SET rewardId = @rewardId, updatedAt = @updatedAt WHERE id = @giveawayId",
                new { giveawayId, rewardId, updatedAt },
                cancellationToken: cancellationToken)
            );
    }

    public async Task ClearEntriesAsync(Guid giveawayId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                DELETE FROM GiveawayWinner WHERE giveawayId = @giveawayId;
                DELETE FROM GiveawayParticipant WHERE giveawayId = @giveawayId
                """,
                new { giveawayId },
                cancellationToken: cancellationToken)
            );
    }

    public async Task DeleteAsync(Guid giveawayId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                """
                DELETE FROM GiveawayWinner WHERE giveawayId = @giveawayId;
                DELETE FROM GiveawayParticipant WHERE giveawayId = @giveawayId;
                DELETE FROM Giveaway WHERE id = @giveawayId
                """,
                new { giveawayId },
                cancellationToken: cancellationToken)
            );
    }

    public async Task<IReadOnlyDictionary<Guid, GiveawayCounts>> CountsAsync(int channelId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<CountRow>(
            new CommandDefinition(
                """
                SELECT g.id                                                                   AS GiveawayId,
                       (SELECT COUNT(*) FROM GiveawayParticipant p WHERE p.giveawayId = g.id) AS Participants,
                       (SELECT COUNT(*) FROM GiveawayWinner w WHERE w.giveawayId = g.id)      AS Winners
                FROM Giveaway g
                WHERE g.channelId = @channelId
                """,
                new { channelId },
                cancellationToken: cancellationToken)
            );

        return rows.ToDictionary(row => row.GiveawayId, row => new GiveawayCounts(row.Participants, row.Winners));
    }

    public async Task<bool> AddParticipantAsync(GiveawayParticipantRecord participant, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var written = await connection.ExecuteAsync(
            new CommandDefinition(
                $"""
                INSERT IGNORE INTO GiveawayParticipant ({ParticipantColumns})
                VALUES (@GiveawayId, @UserId, @UserName, @RedemptionId, @IsFollower, @subTier, @IsVip, @IsModerator, @Multiplier, @EnteredAt)
                """,
                new
                {
                    participant.GiveawayId,
                    participant.UserId,
                    participant.UserName,
                    participant.RedemptionId,
                    participant.IsFollower,
                    subTier = participant.SubTier.ToString(),
                    participant.IsVip,
                    participant.IsModerator,
                    participant.Multiplier,
                    participant.EnteredAt,
                },
                cancellationToken: cancellationToken)
            );

        return written is 1;
    }

    public async Task<bool> HasParticipantAsync(Guid giveawayId, string userId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var found = await connection.ExecuteScalarAsync<int?>(
            new CommandDefinition(
                "SELECT 1 FROM GiveawayParticipant WHERE giveawayId = @giveawayId AND userId = @userId",
                new { giveawayId, userId },
                cancellationToken: cancellationToken)
            );

        return found is not null;
    }

    public async Task<IReadOnlyList<GiveawayParticipantRecord>> GetParticipantsAsync(Guid giveawayId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<ParticipantRow>(
            new CommandDefinition(
                $"SELECT {ParticipantColumns} FROM GiveawayParticipant WHERE giveawayId = @giveawayId ORDER BY enteredAt, userId",
                new { giveawayId },
                cancellationToken: cancellationToken)
            );

        return [.. rows.Select(row => row.ToParticipant())];
    }

    public async Task SetParticipantMultiplierAsync(Guid giveawayId, string userId, double multiplier, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        await connection.ExecuteAsync(
            new CommandDefinition(
                "UPDATE GiveawayParticipant SET multiplier = @multiplier WHERE giveawayId = @giveawayId AND userId = @userId",
                new { giveawayId, userId, multiplier },
                cancellationToken: cancellationToken)
            );
    }

    public async Task<bool> RemoveParticipantAsync(Guid giveawayId, string userId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var removed = await connection.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM GiveawayParticipant WHERE giveawayId = @giveawayId AND userId = @userId",
                new { giveawayId, userId },
                cancellationToken: cancellationToken)
            );

        return removed is 1;
    }

    public async Task<GiveawayWinnerRecord> AddWinnerAsync(GiveawayWinnerRecord winner, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();
        await connection.OpenAsync(cancellationToken);

        for (var attempt = 1; ; attempt++)
        {
            var next = await connection.ExecuteScalarAsync<int>(
                new CommandDefinition(
                    "SELECT COALESCE(MAX(drawOrder), 0) + 1 FROM GiveawayWinner WHERE giveawayId = @GiveawayId",
                    new { winner.GiveawayId },
                    cancellationToken: cancellationToken)
                );

            var placed = winner with { DrawOrder = next };

            try
            {
                await connection.ExecuteAsync(
                    new CommandDefinition(
                        $"""
                        INSERT INTO GiveawayWinner ({WinnerColumns})
                        VALUES (@GiveawayId, @DrawOrder, @UserId, @UserName, @Multiplier, @WonAt)
                        """,
                        placed,
                        cancellationToken: cancellationToken)
                    );

                return placed;
            }
            catch (MySqlException exception) when (exception.Number is DuplicateKey && attempt < OrderAttempts)
            {
            }
        }
    }

    public async Task<IReadOnlyList<GiveawayWinnerRecord>> GetWinnersAsync(Guid giveawayId, CancellationToken cancellationToken)
    {
        await using var connection = connections.Create();

        var rows = await connection.QueryAsync<WinnerRow>(
            new CommandDefinition(
                $"SELECT {WinnerColumns} FROM GiveawayWinner WHERE giveawayId = @giveawayId ORDER BY drawOrder",
                new { giveawayId },
                cancellationToken: cancellationToken)
            );

        return [.. rows.Select(row => row.ToWinner())];
    }

    private static object Parameters(GiveawayConfig config)
    {
        var required = config.Requirements;

        return new
        {
            config.Id,
            config.ChannelId,
            config.RewardId,
            config.Title,
            config.Description,
            config.Cost,
            status = config.Status.ToString(),
            config.UpdatedAt,
            config.CooldownSeconds,
            config.MaxPerStream,
            config.MaxPerUserPerStream,
            requireFollower = required.Follower is RequirementState.Required,
            excludeFollower = required.Follower is RequirementState.Excluded,
            requireSubscriber = required.Subscriber is RequirementState.Required,
            excludeSubscriber = required.Subscriber is RequirementState.Excluded,
            requireTier2 = required.Tier2 is RequirementState.Required,
            excludeTier2 = required.Tier2 is RequirementState.Excluded,
            requireTier3 = required.Tier3 is RequirementState.Required,
            excludeTier3 = required.Tier3 is RequirementState.Excluded,
            requireVip = required.Vip is RequirementState.Required,
            excludeVip = required.Vip is RequirementState.Excluded,
            requireModerator = required.Moderator is RequirementState.Required,
            excludeModerator = required.Moderator is RequirementState.Excluded,
            multiplierBase = config.Multipliers.Base,
            multiplierFollower = config.Multipliers.Follower,
            multiplierSubscriber = config.Multipliers.Subscriber,
            multiplierTier2 = config.Multipliers.Tier2,
            multiplierTier3 = config.Multipliers.Tier3,
            multiplierVip = config.Multipliers.Vip,
            multiplierModerator = config.Multipliers.Moderator
        };
    }

    private static RequirementState StateOf(bool required, bool excluded)
    {
        if (required && !excluded) return RequirementState.Required;
        if (excluded && !required) return RequirementState.Excluded;

        return RequirementState.Ignored;
    }

    private static DateTime AsUtc(DateTime stored)
    {
        return DateTime.SpecifyKind(stored, DateTimeKind.Utc);
    }

    private sealed class ConfigRow
    {
        public Guid Id { get; init; }
        public int ChannelId { get; init; }
        public Guid RewardId { get; init; }
        public string Title { get; init; } = "";
        public string Description { get; init; } = "";
        public long Cost { get; init; }
        public string Status { get; init; } = "";
        public DateTime UpdatedAt { get; init; }
        public long? CooldownSeconds { get; init; }
        public long? MaxPerStream { get; init; }
        public long? MaxPerUserPerStream { get; init; }
        public bool RequireFollower { get; init; }
        public bool ExcludeFollower { get; init; }
        public bool RequireSubscriber { get; init; }
        public bool ExcludeSubscriber { get; init; }
        public bool RequireTier2 { get; init; }
        public bool ExcludeTier2 { get; init; }
        public bool RequireTier3 { get; init; }
        public bool ExcludeTier3 { get; init; }
        public bool RequireVip { get; init; }
        public bool ExcludeVip { get; init; }
        public bool RequireModerator { get; init; }
        public bool ExcludeModerator { get; init; }
        public double MultiplierBase { get; init; }
        public double MultiplierFollower { get; init; }
        public double MultiplierSubscriber { get; init; }
        public double MultiplierTier2 { get; init; }
        public double MultiplierTier3 { get; init; }
        public double MultiplierVip { get; init; }
        public double MultiplierModerator { get; init; }

        public GiveawayConfig ToConfig()
        {
            return new GiveawayConfig(
                Id,
                ChannelId,
                RewardId.ToString(),
                Title,
                Description,
                Cost,
                Enum.TryParse<GiveawayStatus>(Status, out var status) ? status : GiveawayStatus.Draft,
                AsUtc(UpdatedAt),
                CooldownSeconds,
                MaxPerStream,
                MaxPerUserPerStream,
                new GiveawayRequirements(
                    StateOf(RequireFollower, ExcludeFollower),
                    StateOf(RequireSubscriber, ExcludeSubscriber),
                    StateOf(RequireTier2, ExcludeTier2),
                    StateOf(RequireTier3, ExcludeTier3),
                    StateOf(RequireVip, ExcludeVip),
                    StateOf(RequireModerator, ExcludeModerator)),
                new GiveawayMultipliers(
                    MultiplierBase,
                    MultiplierFollower,
                    MultiplierSubscriber,
                    MultiplierTier2,
                    MultiplierTier3,
                    MultiplierVip,
                    MultiplierModerator));
        }
    }

    private sealed class ParticipantRow
    {
        public Guid GiveawayId { get; init; }
        public string UserId { get; init; } = "";
        public string UserName { get; init; } = "";
        public Guid RedemptionId { get; init; }
        public bool IsFollower { get; init; }
        public string SubTier { get; init; } = "";
        public bool IsVip { get; init; }
        public bool IsModerator { get; init; }
        public double Multiplier { get; init; }
        public DateTime EnteredAt { get; init; }

        public GiveawayParticipantRecord ToParticipant()
        {
            return new GiveawayParticipantRecord(
                GiveawayId,
                UserId,
                UserName,
                RedemptionId.ToString(),
                IsFollower,
                Enum.TryParse<SubscriptionTier>(SubTier, out var tier) ? tier : SubscriptionTier.None,
                IsVip,
                IsModerator,
                Multiplier,
                AsUtc(EnteredAt));
        }
    }

    private sealed class WinnerRow
    {
        public Guid GiveawayId { get; init; }
        public int DrawOrder { get; init; }
        public string UserId { get; init; } = "";
        public string UserName { get; init; } = "";
        public double Multiplier { get; init; }
        public DateTime WonAt { get; init; }

        public GiveawayWinnerRecord ToWinner()
        {
            return new GiveawayWinnerRecord(GiveawayId, DrawOrder, UserId, UserName, Multiplier, AsUtc(WonAt));
        }
    }

    private sealed class CountRow
    {
        public Guid GiveawayId { get; init; }
        public int Participants { get; init; }
        public int Winners { get; init; }
    }
}