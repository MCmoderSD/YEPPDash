# Giveaway Reference

How a channel point redemption becomes a weighted slice on a wheel — `backend/YEPPDash.Api/{Repositories,Services,Controllers}/Giveaway*`.

Unlike the subathon timer and the queue, nothing here is shared with YEPPBot. The whole feature is
YEPPDash talking to Twitch: it owns the reward, listens for redemptions over EventSub, and fulfils
or refunds each one itself.

```
redeem  →  Twitch EventSub  →  GiveawaySource  →  GiveawayService  ┐
                                                                   ├→  helix.GiveawayParticipant
broadcaster draws  →  GiveawayService.Pick  →  helix.GiveawayWinner ┘
                                             │
                                             └→  GiveawayHub  →  SSE  →  dashboard + OBS overlay
```

## Three tables

`Giveaway` is the configuration: the Twitch reward it owns, its status, the per-stream limits, and
for each of the six roles a `require`/`exclude` pair plus a multiplier. `GiveawayParticipant` is one
row per entrant, keyed `(giveawayId, userId)` so a second redemption cannot enter the same person
twice. `GiveawayWinner` is keyed `(giveawayId, drawOrder)`, which is what makes the draw order the
identity of a win rather than a column that could drift.

Ids are `CHAR(36)` holding a v4 UUID, matching what Twitch does with its own ids. MySqlConnector
maps that column back as a `Guid`, so the row classes declare `Guid` and convert on the way out —
declaring `string` there fails at runtime with `Object must implement IConvertible`.

## The redemption filter has to come first

`EventSubHost.NotifyAsync` picks its listeners by **subscription type alone**:

```csharp
plan.Where(planned => string.Equals(planned.Request.Type, type, StringComparison.Ordinal))
```

The `reward_id` in the subscription condition is honoured by Twitch, not by the dispatch. So in a
channel that runs both features, `GiveawaySource` is handed the timeout reward's redemptions and
`TimeoutRewardSource` is handed the giveaway's. Each handler's first job is to recognise its own:

```csharp
var config = await repository.GetByRewardAsync(channelId, rewardId, cancellationToken);
if (config is null) return;
```

That check must stay **above** `RedemptionLogRepository.TryRecordAsync`. The log is shared and
claims a redemption id exactly once; claiming first and filtering second would have whichever source
ran first swallow the other's redemption, and the viewer would never be refunded.

## The reward must not skip the request queue

Every create and update sends `ShouldRedemptionsSkipRequestQueue = false`. A reward that skips the
queue auto-fulfils, and an auto-fulfilled redemption can no longer be refunded — which is the only
way to hand the points back to somebody the role rules turn away.

## Status is the reward's enabled flag

`Draft` → the reward exists on Twitch and is switched off. `Open` → `UpdateCustomRewardAsync` has
enabled it and entries are being taken. `Closed` → it is switched off again, which is also the only
state a draw may run in: nobody can enter halfway through and move everybody else's odds.

If the reward has been deleted on Twitch in the meantime, opening recreates it and writes the new
`rewardId` back, rather than failing.

## Weighting

Every entry starts at the base multiplier and is multiplied by each role the viewer held **at the
moment they entered**:

```
weight = Base × Follower × Subscriber × Tier2 × Tier3 × VIP × Moderator   (only those that apply)
```

A subscription counts twice over: `Subscriber` for any tier, plus `Tier2` or `Tier3` for exactly
that tier, never both. Only the ratio between weights matters, so a base below 1 is a way of making
role bonuses count for more, not a penalty.

Editing multipliers while a giveaway is closed re-weighs everybody already entered, using the roles
stored on their row — no one is taken off the wheel and nobody is re-checked against Twitch.

`Pick()` walks the cumulative weights against one roll. A zero weight is legal and means that entry
can never win; the rounding remainder is handed to the last entrant who *can*, so a float sum that
lands a hair short cannot return somebody with no chance.

## Two audiences on one hub

`GiveawayHub.Publish` takes a `GiveawayAudience`, and a listener only receives its own:

- `Dashboard` — authenticated. Entrants as they arrive, status changes, winners.
- `Overlay` — anonymous. The slice list, spins, and dismissals.

The split is the point. The overlay stream is open to anyone holding the link, so the entrant feed —
display names, roles, weights — must never be published to it.

## The overlay link is the giveaway id

`/giveaway/overlay?giveaway=<uuid>` carries nothing else. The API resolves the channel from the id
(`GiveawayService.ChannelOfAsync`) and subscribes that overlay to the right channel's feed. An
earlier version also carried `?channel=`, which added length without adding anything: the channel id
is public, so it made the link longer and no harder to guess, while a v4 UUID is already unique
across every channel.

## Drawing

The draw is server-side. `POST /giveaway/{id}/draw` picks the winner, writes the `GiveawayWinner`
row, and returns the winner **and the index of their slice**. The dashboard and the overlay then
spin their wheels to that index, so the animation lands where the server already decided rather than
the other way round.

The winner row is written before the wheel finishes, so the dashboard holds the SSE `winner` event
until the wheel lands — otherwise the name appears seconds before the spin ends.
