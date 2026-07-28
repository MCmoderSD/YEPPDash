using MySqlConnector;

namespace YEPPDash.Api.Repositories;

public sealed class YeppDashConnectionFactory(string connectionString)
{
    public MySqlConnection Create()
    {
        return new MySqlConnection(connectionString);
    }
}