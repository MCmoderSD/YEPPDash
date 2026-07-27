using YEPPDash.Api.Contracts;
using YEPPDash.Api.Data;

namespace YEPPDash.Api.Services;

// Intentionally a thin pass-through — this only backs the throwaway /api/_internal/dbcheck
// endpoint (ROADMAP Phase 0, step 10), there's no business logic to add yet. Kept as a proper
// service rather than having the endpoint call the repository directly, so it already sits in
// the same Endpoint -> Service -> Repository shape the rest of the app will grow into.
public sealed class DiagnosticsService(IChannelRepository channelRepository) : IDiagnosticsService
{
    public Task<IReadOnlyList<ChannelSummary>> GetSampleChannelsAsync() =>
        channelRepository.GetSampleAsync();
}
