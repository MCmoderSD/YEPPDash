using YEPPDash.Api.Auth;
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
// Constructed here rather than by the container so uptime is measured from startup, not from the
// first request that happens to ask for it.
builder.Services.AddSingleton(new UptimeTracker());
builder.Services.AddSingleton<TwitchChannelCache>();
builder.Services.AddScoped<TwitchChannelService>();
builder.Services.AddScoped<QuoteRepository>();
builder.Services.AddScoped<QuoteService>();
builder.Services.AddScoped<BirthdayRepository>();
builder.Services.AddScoped<BirthdayService>();
builder.Services.AddScoped<BdsmRepository>();
builder.Services.AddScoped<BdsmService>();
builder.Services.AddAuthorization();
builder.Services.AddControllers();

var app = builder.Build();

await app.Services.InitializeYeppDashDatabaseAsync(dbTarget);

app.UseCors(frontendCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

app.MapYeppDashHealthChecks();
app.MapControllers();

app.Run();