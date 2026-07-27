using System.Data;
using Dapper;
using MySqlConnector;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddTransient<MySqlConnection>(_ =>
    new MySqlConnection(builder.Configuration.GetConnectionString("Helix")
        ?? throw new InvalidOperationException("Missing connection string 'ConnectionStrings:Helix'.")));

// MariaDB's BIT(1) columns (Channel.active/autoShoutout) come back from MySqlConnector
// as UInt64, not bool — confirmed empirically via /api/_internal/dbcheck. This handler
// makes Dapper map them to bool everywhere so query models can just use `bool`.
SqlMapper.AddTypeHandler(new BitBoolTypeHandler());

var app = builder.Build();

app.MapGet("/", () => "Hello World!");

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
