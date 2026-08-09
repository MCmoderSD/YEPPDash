namespace YEPPDash.Api.Exceptions.Module;

/// <summary>
/// The <c>Blacklist</c> table has a foreign key onto <c>Channel</c>, not <c>User</c> — a channel the
/// bot has never joined has no row there and cannot hold blocked modules.
/// </summary>
public sealed class UnknownModuleChannelException(int channelId, Exception inner)
    : Exception($"Channel {channelId} has no row in YEPPBot's Channel table.", inner);
