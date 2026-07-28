using YEPPDash.Api.Auth;
using YEPPDash.Api.Data;
using YEPPDash.Api.Helpers;

var builder = WebApplication.CreateBuilder(args);

#if DEBUG
// All local credentials (DB connection strings, Twitch client id/secret) live in user
// secrets. The default builder only loads those when ASPNETCORE_ENVIRONMENT=Development
// *and* it can resolve the UserSecretsId from the entry assembly — and depending on how
// the app is launched (launch profile, raw .exe, IDE run configuration) either of those
// can silently not hold. Load them unconditionally in Debug builds so startup does not
// depend on the launcher. Release builds (the containers) never hit this and use env vars.
builder.Configuration.AddUserSecrets<Program>(optional: true);

// User secrets are resolved under the launching account's APPDATA, which makes them fragile:
// whoever (or whatever) starts the process decides whether they are found at all. This file
// sits next to the project instead, so it is independent of the launcher. It is gitignored and
// Debug-only — either source alone is enough, and this one wins when both are present.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);
#endif

// Selects which of the two real MariaDB servers (Dev: 10.10.10.1, Prod: dedi.mcmodersd.de)
// this instance talks to, and which of YEPPBot's two existing Twitch apps it authenticates
// against — dashboard and bot share the same Twitch identity per environment (PLAN.md#auth).
// Both sets of credentials are always configured; dbTarget just picks one, so the same
// container image can be pointed at either without a rebuild.
var dbTarget = builder.Configuration["DbTarget"] ?? "Dev";

// The Angular frontend always calls this API cross-origin (different port locally, different
// subdomain in prod — no shared-origin reverse proxy anymore, see PLAN.md#deployment), so every
// browser-driven request needs an explicit CORS policy naming its exact origin, not a wildcard,
// since credentials (the auth cookie) are involved.
const string FrontendCorsPolicy = "Frontend";
var allowedFrontendOrigins = builder.Configuration.GetAllowedFrontendOrigins();
builder.Services.AddCors(options => options.AddPolicy(FrontendCorsPolicy, policy => policy
    .WithOrigins(allowedFrontendOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

builder.Services.AddYeppDashDatabase(builder.Configuration, dbTarget);
builder.Services.AddYeppDashAuth(builder.Configuration, builder.Environment, dbTarget);
builder.Services.AddAuthorization();
builder.Services.AddControllers();

var app = builder.Build();

app.UseCors(FrontendCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

// Health checks use the dedicated middleware rather than a controller action — that's the
// idiomatic ASP.NET Core mechanism regardless of whether the rest of the API is MVC or minimal,
// and it composes fine alongside MapControllers().
app.MapHealthChecks("/health");
app.MapControllers();

app.Run();
