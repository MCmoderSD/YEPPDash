using System.Reflection;
using Microsoft.Extensions.Configuration.UserSecrets;

namespace YEPPDash.Api.Helpers;

public static class ConfigurationExtensions
{
    // Missing local credentials are the single most likely startup failure, and "it's missing"
    // alone doesn't say why — so report the resolved UserSecretsId, APPDATA, and the exact
    // secrets file path/existence, which is what decides whether user secrets can be found at
    // all. `context` is free-form extra info to include in the message (e.g. "DbTarget 'Dev'").
    public static string GetRequiredValue(this IConfiguration configuration, string key, string? context = null)
    {
        var value = configuration[key];
        if (!string.IsNullOrEmpty(value)) return value;

        var secretsId = Assembly.GetEntryAssembly()?.GetCustomAttribute<UserSecretsIdAttribute>()?.UserSecretsId;
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var secretsPath = secretsId is null
            ? "<n/a>"
            : Path.Combine(appData, "Microsoft", "UserSecrets", secretsId, "secrets.json");

        throw new InvalidOperationException(
            $"Missing configuration '{key}'" + (context is null ? "" : $" ({context})") + ". " +
            $"UserSecretsId from assembly: {secretsId ?? "<none — user secrets can never load>"}. " +
            $"APPDATA: {(string.IsNullOrEmpty(appData) ? "<empty!>" : appData)}. " +
            $"Secrets file: {secretsPath} (exists: {secretsId is not null && File.Exists(secretsPath)}). " +
            "Expected in user secrets or appsettings.Local.json — check with: dotnet user-secrets list");
    }
}
