using YEPPDash.Api.Contracts;

namespace YEPPDash.Api.Services;

public interface IDiagnosticsService
{
    Task<IReadOnlyList<ChannelSummary>> GetSampleChannelsAsync();
}
