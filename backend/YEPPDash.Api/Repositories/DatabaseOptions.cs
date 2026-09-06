using MySqlConnector;

namespace YEPPDash.Api.Repositories;

public sealed class DatabaseOptions
{
    public string Host { get; init; } = "";

    public uint Port { get; init; } = 3306;

    public string User { get; init; } = "";

    public string Password { get; init; } = "";

    public string YeppBot { get; init; } = "";

    public string YeppDash { get; init; } = "";

    public string YeppBotConnectionString => For(YeppBot);

    public string YeppDashConnectionString => For(YeppDash);

    public static DatabaseOptions From(IConfiguration configuration, string environmentName)
    {
        var database = configuration.GetSection("Database");
        var schemas = database.GetSection($"Schemas:{environmentName}");

        var options = new DatabaseOptions
        {
            Host = database["Host"] ?? "",
            Port = database.GetValue("Port", 3306u),
            User = database["User"] ?? "",
            Password = database["Password"] ?? "",
            YeppBot = schemas["YEPPBot"] ?? "",
            YeppDash = schemas["YEPPDash"] ?? ""
        };

        (string Key, string Value)[] settings =
        [
            ("Database:Host", options.Host),
            ("Database:User", options.User),
            ("Database:Password", options.Password),
            ($"Database:Schemas:{environmentName}:YEPPBot", options.YeppBot),
            ($"Database:Schemas:{environmentName}:YEPPDash", options.YeppDash)
        ];

        string[] missing =
        [
            .. settings
                .Where(setting => string.IsNullOrWhiteSpace(setting.Value))
                .Select(setting => setting.Key)
        ];

        if (missing.Length > 0)
        {
            throw new InvalidOperationException(
                $"Incomplete database settings for environment '{environmentName}': {string.Join(", ", missing)} not set. " +
                "The account arrives from the environment as Database__User and Database__Password, or from " +
                "appsettings.Local.json. Host and the schema names have defaults in appsettings.json, so an " +
                $"empty one of those means either that file was changed or that ASPNETCORE_ENVIRONMENT is " +
                $"set to '{environmentName}', which appsettings.json has no schemas for.");
        }

        return options;
    }

    private string For(string database)
    {
        return new MySqlConnectionStringBuilder
        {
            Server = Host,
            Port = Port,
            UserID = User,
            Password = Password,
            Database = database
        }.ConnectionString;
    }
}