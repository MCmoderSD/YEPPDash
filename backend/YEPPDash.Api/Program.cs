using YEPPDash.Api.Auth;
using YEPPDash.Api.Bot;
using YEPPDash.Api.EventSub;
using YEPPDash.Api.Helpers;
using YEPPDash.Api.Repositories;
using YEPPDash.Api.Services;

var builder = WebApplication.CreateBuilder(args);

#if DEBUG
builder.Configuration.AddUserSecrets<Program>(optional: true);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);
#endif

var environmentName = builder.Environment.EnvironmentName;
var database = DatabaseOptions.From(builder.Configuration, environmentName);

const string frontendCorsPolicy = "Frontend";
var allowedFrontendOrigins = builder.Configuration.GetAllowedFrontendOrigins(environmentName);
builder.Services.AddCors(options => options.AddPolicy(frontendCorsPolicy, policy => policy
    .WithOrigins(allowedFrontendOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

builder.Services.AddYeppDashDatabase(database);
builder.Services.AddYeppDashAuth(builder.Configuration, environmentName, database);
builder.Services.AddYeppBot(builder.Configuration, environmentName);
builder.Services.AddYeppDashEventSub();

builder.Services.AddSingleton(new UptimeTracker());
builder.Services.AddYeppDashTwitch();
builder.Services.AddYeppDashContent();
builder.Services.AddYeppDashStreams();
builder.Services.AddYeppDashRewards();
builder.Services.AddAuthorization();
builder.Services.AddControllers();

var app = builder.Build();

await app.Services.InitializeYeppDashDatabaseAsync(environmentName);

app.UseYeppDashRequestLogging();
app.UseCors(frontendCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

app.MapYeppDashHealthChecks();
app.MapControllers();

app.Run();