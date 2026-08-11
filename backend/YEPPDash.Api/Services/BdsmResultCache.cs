using System.Collections.Concurrent;
using MCmoderSD.BdsmTestApi.Data;

namespace YEPPDash.Api.Services;

// A finished test never changes, so results are kept for the life of the process rather than
// expired. Without this every page load would hit BDSMTest.org once per listed result, and the
// community tab lists one per follower.
public sealed class BdsmResultCache
{
    private readonly ConcurrentDictionary<string, TestResult> _results = new(StringComparer.Ordinal);

    public TestResult? Get(string resultId)
    {
        return _results.GetValueOrDefault(resultId);
    }

    public void Set(string resultId, TestResult result)
    {
        _results[resultId] = result;
    }
}
