using System.Text.Json.Serialization;

namespace YEPPDash.Api.Data.Spotify;

[JsonConverter(typeof(JsonStringEnumConverter<SpotifyConnectionStatus>))]
public enum SpotifyConnectionStatus
{
    Connected,
    Revoked,
    Error
}

/// <summary>
/// One broadcaster's link to Spotify. The two tokens are held in plaintext here and only here —
/// everything that leaves this process carries <see cref="SpotifyConnectionStatus"/> instead.
/// </summary>
public sealed record SpotifyConnection(
    int ChannelId,
    string SpotifyUserId,
    string DisplayName,
    string RefreshToken,
    string? AccessToken,
    DateTime? ExpiresAt,
    DateTime ConnectedAt,
    SpotifyConnectionStatus Status
);
