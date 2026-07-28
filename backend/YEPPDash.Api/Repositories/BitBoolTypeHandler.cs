using System.Data;
using Dapper;

namespace YEPPDash.Api.Repositories;

// MariaDB's BIT(1) columns (Channel.active/autoShoutout) come back from MySqlConnector as
// UInt64, not bool — confirmed empirically via /api/_internal/dbcheck. Registering this handler
// makes Dapper map them to bool everywhere so query models can just use `bool`.
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
