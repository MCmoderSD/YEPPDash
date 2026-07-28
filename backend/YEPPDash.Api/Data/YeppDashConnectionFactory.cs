using MySqlConnector;

namespace YEPPDash.Api.Data;

public sealed class YeppDashConnectionFactory(string connectionString)
{
    public MySqlConnection Create()
    {
        return new MySqlConnection(connectionString);
    }
}
