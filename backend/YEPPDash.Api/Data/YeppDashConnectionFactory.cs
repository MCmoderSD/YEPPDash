using MySqlConnector;

namespace YEPPDash.Api.Data;

// Connections to YEPPDash's *own* database (dashboard-owned tables, read/write). Deliberately a
// separate type from the plain MySqlConnection registration, which points at YEPPBot's `helix`
// schema through a read-only user and must stay read-only.
public sealed class YeppDashConnectionFactory(string connectionString)
{
    public MySqlConnection Create()
    {
        return new MySqlConnection(connectionString);
    }
}
