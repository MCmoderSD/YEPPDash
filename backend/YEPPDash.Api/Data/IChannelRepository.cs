using YEPPDash.Api.Contracts;

namespace YEPPDash.Api.Data;

public interface IChannelRepository
{
    Task<IReadOnlyList<ChannelSummary>> GetSampleAsync(int take = 5);
}
