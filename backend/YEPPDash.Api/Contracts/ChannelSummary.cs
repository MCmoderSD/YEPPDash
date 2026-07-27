namespace YEPPDash.Api.Contracts;

// Doubles as both the Dapper projection and the API response shape — fine for the throwaway
// diagnostic endpoint this currently backs (ROADMAP Phase 0, step 10). A real feature would
// keep the persistence model and the response contract separate.
public sealed record ChannelSummary(int Id, bool Active, bool AutoShoutout);
