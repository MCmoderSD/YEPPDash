using System.Data;
using System.Reflection;
using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Extensions.Configuration.UserSecrets;
using MySqlConnector;

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
// this instance talks to. Both connection strings are always configured; DbTarget just
// picks one, so the same container image can be pointed at either without a rebuild.
var dbTarget = builder.Configuration["DbTarget"] ?? "Dev";
var helixConnectionStringKey = $"Helix{dbTarget}";

builder.Services.AddTransient<MySqlConnection>(_ =>
    new MySqlConnection(builder.Configuration.GetConnectionString(helixConnectionStringKey)
        ?? throw new InvalidOperationException(
            $"Missing connection string 'ConnectionStrings:{helixConnectionStringKey}' for DbTarget '{dbTarget}'.")));

// MariaDB's BIT(1) columns (Channel.active/autoShoutout) come back from MySqlConnector
// as UInt64, not bool — confirmed empirically via /api/_internal/dbcheck. This handler
// makes Dapper map them to bool everywhere so query models can just use `bool`.
SqlMapper.AddTypeHandler(new BitBoolTypeHandler());

// Same DbTarget switch also picks which of YEPPBot's two existing Twitch apps (Dev/Prod)
// this instance authenticates against — dashboard and bot share the same Twitch identity,
// so no separate app registration is needed (see PLAN.md#auth).
var twitchClientId = RequireConfig($"Twitch:ClientId{dbTarget}");
var twitchClientSecret = RequireConfig($"Twitch:ClientSecret{dbTarget}");

// Missing local credentials are the single most likely startup failure, and "it's missing"
// alone doesn't say why — so report the environment and the UserSecretsId actually resolved
// from the assembly, which is what decides whether user secrets can be found at all.
string RequireConfig(string key)
{
    var value = builder.Configuration[key];
    if (!string.IsNullOrEmpty(value)) return value;

    var secretsId = typeof(Program).Assembly
        .GetCustomAttribute<UserSecretsIdAttribute>()?.UserSecretsId;

    // The secrets file is looked up relative to APPDATA, which is per-user and differs if the
    // process runs elevated or as another account — so report the resolved path and whether it
    // actually exists, otherwise "missing" is indistinguishable from "looked in the wrong place".
    var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
    var secretsPath = secretsId is null
        ? "<n/a>"
        : Path.Combine(appData, "Microsoft", "UserSecrets", secretsId, "secrets.json");

    throw new InvalidOperationException(
        $"Missing configuration '{key}' (DbTarget '{dbTarget}', environment '{builder.Environment.EnvironmentName}'). " +
        $"UserSecretsId from assembly: {secretsId ?? "<none — user secrets can never load>"}. " +
        $"APPDATA: {(string.IsNullOrEmpty(appData) ? "<empty!>" : appData)}. " +
        $"Secrets file: {secretsPath} (exists: {secretsId is not null && File.Exists(secretsPath)}). " +
        "Expected in user secrets — check with: dotnet user-secrets list");
}

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
    })
    .AddCookie(options =>
    {
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    })
    .AddOpenIdConnect(options =>
    {
        // Twitch's OIDC discovery document isn't at the conventional root path.
        options.MetadataAddress = "https://id.twitch.tv/oauth2/.well-known/openid-configuration";
        options.ClientId = twitchClientId;
        options.ClientSecret = twitchClientSecret;
        options.ResponseType = "code";
        options.ResponseMode = "query";
        options.CallbackPath = "/api/auth/callback";
        options.SaveTokens = true;
        // By default the handler rewrites inbound OIDC claims to the long WS-Federation URIs
        // ("sub" -> ".../claims/nameidentifier" etc.), so looking them up by their OIDC names
        // silently yields null. Keep the original names — they're what the endpoints below use.
        options.MapInboundClaims = false;
        options.TokenValidationParameters.NameClaimType = "preferred_username";
        options.Scope.Clear();
        options.Scope.Add("openid");
        // Requesting the email *claim* (see OnRedirectToIdentityProvider below) is not enough
        // on its own — Twitch rejects that with "insufficient_scope" unless the matching Helix
        // scope is granted too. Both parts are required to get an email into the id_token.
        options.Scope.Add("user:read:email");

        options.Events = new OpenIdConnectEvents
        {
            // Twitch only returns email/preferred_username in the id_token if the authorize
            // request explicitly asks for them via the "claims" parameter — confirmed
            // empirically: without preferred_username listed here, "login" came back null
            // even though "sub" (always included) and "email" (already requested) worked.
            OnRedirectToIdentityProvider = context =>
            {
                context.ProtocolMessage.SetParameter("claims",
                    "{\"id_token\":{\"email\":null,\"preferred_username\":null}}");
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => "Hello World!");

app.MapGet("/api/auth/login", (string? returnUrl) =>
    Results.Challenge(
        new AuthenticationProperties { RedirectUri = returnUrl ?? "/api/auth/me" },
        [OpenIdConnectDefaults.AuthenticationScheme]));

app.MapPost("/api/auth/logout", async (HttpContext ctx) =>
{
    await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.Ok();
});

app.MapGet("/api/auth/me", (ClaimsPrincipal user) => Results.Ok(new
{
    twitchId = user.FindFirst("sub")?.Value,
    login = user.FindFirst("preferred_username")?.Value,
    email = user.FindFirst("email")?.Value
})).RequireAuthorization();

if (app.Environment.IsDevelopment())
{
    // Throwaway diagnostic endpoint (ROADMAP Phase 0, step 10) — verifies the
    // least-privilege read-only DB user connects and that Channel.active/autoShoutout
    // map cleanly to bool via the BitBoolTypeHandler below.
    app.MapGet("/api/_internal/dbcheck", async (MySqlConnection connection) =>
    {
        await connection.OpenAsync();

        var channels = await connection.QueryAsync<ChannelCheckRow>(
            "SELECT id, active, autoShoutout FROM Channel LIMIT 5");

        return Results.Ok(channels);
    });
}

app.Run();

internal sealed record ChannelCheckRow(int Id, bool Active, bool AutoShoutout);

internal sealed class BitBoolTypeHandler : SqlMapper.TypeHandler<bool>
{
    public override bool Parse(object value) => value switch
    {
        bool b => b,
        ulong u => u != 0,
        long l => l != 0,
        byte[] bytes => bytes.Length > 0 && bytes[0] != 0,
        _ => Convert.ToBoolean(value)
    };

    public override void SetValue(IDbDataParameter parameter, bool value) => parameter.Value = value;
}
