using MCmoderSD.BdsmTestApi.Core;
using YEPPDash.Api.Auth;
using YEPPDash.Api.Bot;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Services;

var builder = WebApplication.CreateBuilder(args);

#if DEBUG
builder.Configuration.AddUserSecrets<Program>(optional: true);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);
#endif

var dbTarget = builder.Configuration["DbTarget"] ?? "Dev";

const string frontendCorsPolicy = "Frontend";
var allowedFrontendOrigins = builder.Configuration.GetAllowedFrontendOrigins();
builder.Services.AddCors(options => options.AddPolicy(frontendCorsPolicy, policy => policy
    .WithOrigins(allowedFrontendOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

builder.Services.AddYeppDashDatabase(builder.Configuration, dbTarget);
builder.Services.AddYeppDashAuth(builder.Configuration, dbTarget);
builder.Services.AddYeppBot(builder.Configuration, dbTarget);
// Constructed here rather than by the container, so uptime is measured from startup, not from the
// first request that happens to ask for it.
builder.Services.AddSingleton(new UptimeTracker());
builder.Services.AddSingleton<TwitchChannelCache>();
builder.Services.AddSingleton<TwitchUserCache>();
builder.Services.AddHostedService<TwitchUserCacheSweeper>();
builder.Services.AddSingleton<TwitchChannelWarmup>();
builder.Services.AddHostedService<TwitchChannelWarmupWorker>();
builder.Services.AddScoped<TwitchChannelService>();
builder.Services.AddScoped<QuoteRepository>();
builder.Services.AddScoped<QuoteService>();
builder.Services.AddScoped<BirthdayRepository>();
builder.Services.AddScoped<BirthdayService>();
builder.Services.AddScoped<BdsmRepository>();
builder.Services.AddScoped<BdsmService>();
// Only matches are fetched from BDSMTest.org; the results themselves come out of the database.
builder.Services.AddHttpClient<BdsmTestApi>();
builder.Services.AddScoped<RaidRepository>();
builder.Services.AddScoped<RaidService>();
builder.Services.AddScoped<CustomCommandRepository>();
builder.Services.AddScoped<CustomCommandService>();
builder.Services.AddScoped<ShoutoutRepository>();
builder.Services.AddScoped<ShoutoutService>();
builder.Services.AddScoped<WheelRepository>();
builder.Services.AddScoped<WheelService>();
// Singleton: it is what holds the open overlay connections, which outlive any one request.
builder.Services.AddSingleton<WheelHub>();
builder.Services.AddScoped<SubathonTimerRepository>();
builder.Services.AddScoped<SubathonTimerService>();
// Singleton for the same reason as the wheel's: it is what holds the open overlay connections,
// which outlive any one request.
builder.Services.AddSingleton<SubathonTimerHub>();
// The bot drives the timer by writing to the table this shares with it, and has no way to tell us
// it did. This worker is what turns those writes into the events an overlay is waiting on.
builder.Services.AddHostedService<SubathonTimerWatcher>();
builder.Services.AddScoped<QueueRepository>();
builder.Services.AddScoped<QueueService>();
// Singleton for the same reason as the wheel's and the timer's: it is what holds the open
// dashboard connections, which outlive any one request.
builder.Services.AddSingleton<QueueHub>();
// Chat is where the queue is joined and left, and the bot does that by writing to the table this
// shares with it. This worker is what turns those writes into the events a dashboard is waiting on.
builder.Services.AddHostedService<QueueWatcher>();
builder.Services.AddAuthorization();
builder.Services.AddControllers();

var app = builder.Build();

await app.Services.InitializeYeppDashDatabaseAsync(dbTarget);

app.UseYeppDashRequestLogging();
app.UseCors(frontendCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

app.MapYeppDashHealthChecks();
app.MapControllers();

app.Run();