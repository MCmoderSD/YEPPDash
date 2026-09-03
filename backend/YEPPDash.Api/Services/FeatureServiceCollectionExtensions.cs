using MCmoderSD.BdsmTestApi.Core;
using YEPPDash.Api.EventSub;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Services.Streaming;

namespace YEPPDash.Api.Services;

public static class FeatureServiceCollectionExtensions
{
    public static IServiceCollection AddYeppDashTwitch(this IServiceCollection services)
    {
        services.AddSingleton<TwitchChannelCache>();
        services.AddSingleton<TwitchUserCache>();
        services.AddHostedService<TwitchUserCacheSweeper>();
        services.AddSingleton<TwitchChannelWarmup>();
        services.AddHostedService<TwitchChannelWarmupWorker>();
        services.AddScoped<TwitchChannelService>();

        return services;
    }

    public static IServiceCollection AddYeppDashContent(this IServiceCollection services)
    {
        services.AddScoped<QuoteRepository>();
        services.AddScoped<QuoteService>();
        services.AddScoped<BirthdayRepository>();
        services.AddScoped<BirthdayService>();
        services.AddScoped<BdsmRepository>();
        services.AddScoped<BdsmService>();
        // Only matches are fetched from BDSMTest.org; the results themselves come out of the database.
        services.AddHttpClient<BdsmTestApi>();
        services.AddScoped<RaidRepository>();
        services.AddScoped<RaidService>();
        services.AddScoped<CustomCommandRepository>();
        services.AddScoped<CustomCommandService>();
        services.AddScoped<ShoutoutRepository>();
        services.AddScoped<ShoutoutService>();

        return services;
    }

    public static IServiceCollection AddYeppDashStreams(this IServiceCollection services)
    {
        services.AddScoped<WheelRepository>();
        services.AddScoped<WheelService>();
        services.AddSingleton<WheelHub>();

        services.AddScoped<SubathonTimerRepository>();
        services.AddScoped<SubathonTimerService>();
        services.AddSingleton<SubathonTimerHub>();
        services.AddHostedService<SubathonTimerWatcher>();

        services.AddScoped<QueueRepository>();
        services.AddScoped<QueueService>();
        services.AddSingleton<QueueHub>();
        services.AddHostedService<QueueWatcher>();

        return services;
    }

    public static IServiceCollection AddYeppDashRewards(this IServiceCollection services)
    {
        // Spans every channel and every reward: it is what stops one redemption being acted on twice,
        // whichever socket or instance saw it.
        services.AddScoped<RedemptionLogRepository>();
        // The claim-settle-refund bookkeeping both channel point rewards share.
        services.AddScoped<RedemptionSettlement>();

        services.AddScoped<TimeoutRewardRepository>();
        services.AddScoped<TimeoutRewardService>();
        services.AddSingleton<IEventSubSource, TimeoutRewardSource>();
        // Handing a stripped role back is the one part no event announces, so it stays on a clock.
        services.AddHostedService<TimeoutRewardWatcher>();

        services.AddScoped<GiveawayRepository>();
        services.AddScoped<GiveawayService>();
        services.AddSingleton<GiveawayHub>();
        services.AddSingleton<IEventSubSource, GiveawaySource>();

        return services;
    }
}