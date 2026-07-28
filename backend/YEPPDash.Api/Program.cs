using YEPPDash.Api.Auth;
using YEPPDash.Api.Data;
using YEPPDash.Api.Helpers;

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
builder.Services.AddAuthorization();
builder.Services.AddControllers();

var app = builder.Build();

await app.Services.InitializeYeppDashDatabaseAsync(dbTarget);

app.UseCors(frontendCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapControllers();

app.Run();
