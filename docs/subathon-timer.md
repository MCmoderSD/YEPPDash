# Subathon Timer Reference

How the dashboard and **YEPPBot** share a countdown — `backend/YEPPDash.Api/{Repositories,Services,Controllers}/SubathonTimer*`.

This is the one feature where both sides write the same row. Everywhere else the split is clean:
YEPPDash writes to the `helix` schema and tells the bot over HTTP when something has to take effect
now. Here there is no call in either direction — the bot drives the timer from chat, the dashboard
drives it from a browser, and the table is the only thing between them.

```
!timer add 5m  →  YEPPBot  ┐
                           ├→  helix.SubathonTimer  →  watcher  →  SSE  →  OBS overlay
dashboard button →  API    ┘
```

## The table

Owned and migrated by YEPPBot, like the rest of `helix`. YEPPDash only reads and writes it —
`DatabaseInitializationExtensions` is for the YEPPDash-owned schema and does not touch this.

```sql
CREATE TABLE IF NOT EXISTS SubathonTimer
(
    id           INT         NOT NULL PRIMARY KEY,
    running      BIT(1)      NOT NULL DEFAULT b'0',
    endsAt       DATETIME(3)     NULL,
    remaining    INT         NOT NULL DEFAULT 0,
    startSeconds INT         NOT NULL DEFAULT 0,
    style        TEXT        NOT NULL DEFAULT (''),
    updatedAt    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT SubathonTimer_ibfk_1 FOREIGN KEY (id) REFERENCES Channel (id) ON DELETE CASCADE
);
```

| Column | Meaning | Written by |
|---|---|---|
| `id` | The channel's numeric Twitch user id, as everywhere else in this schema | both |
| `running` | Whether it is counting down. Says which of the next two columns is the truth | both |
| `endsAt` | UTC instant it reaches zero. Only meaningful while running | both |
| `remaining` | Seconds left. Only meaningful while paused | both |
| `startSeconds` | What `reset` returns to | dashboard only |
| `style` | Overlay appearance as JSON | dashboard only |
| `updatedAt` | Change marker the dashboard watches. MariaDB maintains it | neither — `ON UPDATE` |

## Nothing ticks

A countdown is never stored as a number that decreases. The row holds **what the clock is set to**,
not **what it currently reads**, so it changes only when a command arrives — a twelve hour subathon
with four hundred additions is four hundred writes, not forty three thousand per viewer. Every client
works the display out for itself from the deadline.

| `running` | the truth is in | the other column |
|---|---|---|
| `1` | `endsAt` — the instant it hits zero | `remaining` is unused |
| `0` | `remaining` — seconds left | `endsAt` is `NULL` |

Running it is an alarm clock ("goes off at 21:47:03"); paused it is a stopwatch someone palmed
("3600 left"). `start` and `pause` are nothing but the conversion between the two shapes.

## The statements

Every command is **one UPDATE** that derives the new value from the old. A lone UPDATE takes its own
row lock, so two people adding time in the same second both land — no transaction, no `FOR UPDATE`,
no retry. It also means the bot issues exactly these: no part of how the timer moves lives only in
the dashboard.

```sql
-- ensure the row (once, on channel join)
INSERT IGNORE INTO SubathonTimer (id) VALUES (?);

-- start
UPDATE SubathonTimer SET running = b'1', endsAt = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL remaining SECOND), remaining = 0
 WHERE id = ? AND running = b'0';

-- stop / pause
UPDATE SubathonTimer SET running = b'0', remaining = GREATEST(0, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(3), endsAt)), endsAt = NULL
 WHERE id = ? AND running = b'1';

-- add <n> / remove <n>  (signed; issue both, exactly one matches)
UPDATE SubathonTimer SET endsAt = GREATEST(DATE_ADD(GREATEST(COALESCE(endsAt, UTC_TIMESTAMP(3)), UTC_TIMESTAMP(3)), INTERVAL ? SECOND), UTC_TIMESTAMP(3))
 WHERE id = ? AND running = b'1';
UPDATE SubathonTimer SET remaining = GREATEST(0, remaining + ?)
 WHERE id = ? AND running = b'0';

-- set <n>   (stops it, like reset)
UPDATE SubathonTimer SET running = b'0', endsAt = NULL, remaining = ? WHERE id = ?;

-- reset
UPDATE SubathonTimer SET running = b'0', endsAt = NULL, remaining = startSeconds WHERE id = ?;
```

The `AND running = …` clauses make every command idempotent: a second `start` matches no rows rather
than pushing the deadline out again and handing back time already spent.

`set` and `reset` both leave the timer stopped. Putting a number on the clock is preparation, not a
move in the run — left counting, the value just typed would start draining before anyone had looked
at it.

### Three places this goes wrong

1. **`GREATEST(endsAt, UTC_TIMESTAMP(3))` on add is not optional.** A running timer that passes its
   deadline keeps `running = 1` with that deadline in the past — that *is* the state of having
   stopped at 00:00, and nothing sets it. Shifting such a deadline directly leaves it in the past, so
   five minutes added to a subathon that ended an hour ago would visibly do nothing.
2. **`GREATEST(…, UTC_TIMESTAMP(3))` on remove** clamps at 00:00 instead of running negative.
3. **Always `UTC_TIMESTAMP(3)`, never `NOW()`.** `DATETIME` carries no zone; `NOW()` is the session's,
   and the timer would shift an hour at the daylight-saving change. Without the `(3)`,
   `UTC_TIMESTAMP()` returns whole seconds however precise the column is.

## How the dashboard notices

The bot writes and tells nobody, so `SubathonTimerWatcher` goes and looks — once a second, and only
for channels an overlay is currently open on. With nothing watching, the query is skipped entirely
rather than prodding the database around the clock.

It compares each row's `updatedAt` against **the last value it published for that channel**, never
against its own clock: the bot, the API and MariaDB each keep their own time, and asking for
"anything newer than a second ago" would drop changes or repeat them depending on which way the drift
ran.

This is why `updatedAt` is `DATETIME(3)` and not `DATETIME`. At second precision two commands in the
same second share a value, and a watcher polling once a second would take the second one for "nothing
happened" — with subs arriving in waves, not a corner case.

Anything the dashboard does is published immediately by `SubathonTimerService`, so a click does not
wait for the next pass. The occasional duplicate is harmless: every message carries the whole state.

## What an overlay receives

`GET /timer/{userId}` and `GET /timer/{userId}/stream` are both `[AllowAnonymous]` — a browser source
is nobody, on whatever machine the stream runs on. The stream is Server-Sent Events with a
twenty-second keep-alive comment, the same shape as the wheel's.

```json
{"type":"state","running":true,"endsAt":"2026-08-24T21:05:00.000Z","remaining":0,
 "startSeconds":28800,"style":"{...}","serverNow":"2026-08-24T20:10:00.000Z"}
```

`serverNow` is not decoration. A viewer works the time left out as `endsAt - now`, and `endsAt` is an
instant on the *server's* clock — a streaming PC running forty seconds fast would show a subathon
forty seconds short forever, and would read 00:00 while the bot still had time on it. The client
measures the offset once per message and renders against that.

## What the bot must not do

- **Never touch `style` or `startSeconds`.** Both are the dashboard's.
- **Never write `updatedAt`.** MariaDB maintains it; writing it by hand is how the mechanism the
  overlay depends on gets broken.
- **Never tick.** No job counting down. If one appears, the whole design is wasted and the dashboard
  starts pushing every second.
- **Never act on expiry.** Nothing fires server-side at 00:00 — clients clamp to zero themselves. A
  "the subathon is over" message in chat means polling the query below, which is the bot's own work.

For a chat reply, let the database do the arithmetic so the bot's host clock never enters into it:

```sql
SELECT running,
       IF(running, GREATEST(0, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(3), endsAt)), remaining) AS remaining
  FROM SubathonTimer WHERE id = ?;
```

## Permissions

`!timer` belongs to the broadcaster and moderators. Without that check anyone in chat can end the
subathon — the difference between a feature and a way in. The dashboard says as much under its
command list, but the check itself lives in YEPPBot.

## Deployment note

`SubathonTimerHub` is an in-process singleton with no backplane, as `WheelHub` is: a second API
replica would leave half the overlays unnotified. `docker-compose.yaml` runs one backend container,
so that holds today.
