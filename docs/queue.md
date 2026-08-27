# Queue Reference

How the dashboard and **YEPPBot** share a waiting list — `backend/YEPPDash.Api/{Repositories,Services,Controllers}/Queue*`.

The second feature where both sides write the same row, and it works the way the subathon timer
does: no call in either direction, chat on one end, a browser on the other, one table between them.
See [`subathon-timer.md`](subathon-timer.md) — the reasoning behind `updatedAt` and the watcher is
the same and is spelled out there in full.

```
!queue join  →  YEPPBot  ┐
                         ├→  helix.Queue  →  watcher  →  SSE  →  dashboard
Done button  →  API      ┘
```

The division of labour: **chat is the only way in.** Joining, leaving and asking are the bot's;
opening, closing, clearing and taking the person at the front off are the dashboard's. Nobody is added from the
dashboard, so nothing there has to check whether they were allowed in.

## The table

Owned and migrated by YEPPBot, like the rest of `helix`. YEPPDash only reads and writes it —
`DatabaseInitializationExtensions` is for the YEPPDash-owned schema and does not touch this.

```sql
CREATE TABLE IF NOT EXISTS Queue
(
    id          INT         NOT NULL PRIMARY KEY,
    isOpen      BIT(1)      NOT NULL DEFAULT b'0',
    requirement ENUM('everyone','follower','subscriber','vip') NOT NULL DEFAULT 'everyone',
    queue       TEXT        NOT NULL DEFAULT (''),
    updatedAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT Queue_ibfk_1 FOREIGN KEY (id) REFERENCES Channel (id) ON DELETE CASCADE
);
```

| Column | Meaning | Written by |
|---|---|---|
| `id` | The channel's numeric Twitch user id, as everywhere else in this schema | both |
| `isOpen` | Whether `!queue join` is accepted. Gates nothing else | both |
| `requirement` | Who may join. **Checked by the bot**, set from the dashboard | dashboard only |
| `queue` | The waiting list: numeric user ids, comma separated, in order | both |
| `updatedAt` | Change marker the dashboard watches. MariaDB maintains it | neither — `ON UPDATE` |

A new row is **closed**, not open: a queue nobody has opened yet should not quietly fill up.

## One text column, and why that is safe

The obvious objection to a comma-separated list is the lost update — read it, append an id in
application code, write it back, and two people joining in the same second leave one of them behind.
During a raid that is not a corner case.

It does not happen here because every mutation is **one UPDATE** that derives the new value from the
old. A lone UPDATE takes its own row lock, so nobody ever holds a stale copy of the list: no
transaction, no `FOR UPDATE`, no retry. Exactly the property the timer rests on.

MariaDB is what makes that possible, because it handles comma lists natively:

| Expression | Gives |
|---|---|
| `FIND_IN_SET(id, queue)` | `0` if absent, otherwise the **1-based place** |
| `SUBSTRING_INDEX(queue, ',', 1)` | the head — whoever is up |
| `TRIM(BOTH ',' FROM REPLACE(CONCAT(',',queue,','), CONCAT(',',id,','), ','))` | the list without `id` |

`FIND_IN_SET` is more than a membership test: it *is* the answer to `!queue status` ("you are third"),
with nothing counted in application code. And because `join` is guarded by `FIND_IN_SET(?, queue) = 0`
no duplicate can ever be created, which is what leaves the removal expression without a special case.

What the column deliberately cannot hold: when somebody joined, a note per entry, or any history of
who has already been served. That would be a second table with a completely different write profile —
append-only, growing without limit — and it can be stood up beside this one later without touching it.

## The statements

```sql
-- ensure the row (once, on channel join)
INSERT IGNORE INTO Queue (id) VALUES (?);

-- !queue open / !queue close
UPDATE Queue SET isOpen = b'1' WHERE id = ? AND isOpen = b'0';
UPDATE Queue SET isOpen = b'0' WHERE id = ? AND isOpen = b'1';

-- !queue reset / !queue clear
UPDATE Queue SET queue = '' WHERE id = ? AND queue <> '';

-- !queue join
UPDATE Queue
   SET queue = CONCAT(queue, IF(queue = '', '', ','), ?)
 WHERE id = ?
   AND isOpen = b'1'
   AND FIND_IN_SET(?, queue) = 0
   AND IF(queue = '', 0, LENGTH(queue) - LENGTH(REPLACE(queue, ',', '')) + 1) < 500;

-- !queue leave
UPDATE Queue
   SET queue = TRIM(BOTH ',' FROM REPLACE(CONCAT(',', queue, ','), CONCAT(',', ?, ','), ','))
 WHERE id = ? AND FIND_IN_SET(?, queue) > 0;

-- !queue list
SELECT isOpen, requirement, queue FROM Queue WHERE id = ?;

-- !queue status                  0 = not in it, otherwise the place
SELECT FIND_IN_SET(?, queue) AS position FROM Queue WHERE id = ?;

-- !queue next                    '' = the queue is empty
SELECT SUBSTRING_INDEX(queue, ',', 1) AS head FROM Queue WHERE id = ?;
```

### Two the dashboard issues and the bot does not

Taking the person at the front off, and changing the order, are the dashboard's, so these are here
to say what they are, not for the bot to send.

```sql
-- the Done button: drop the head, but only the head that was just read
UPDATE Queue
   SET queue = IF(LOCATE(',', queue) > 0, SUBSTRING(queue, LOCATE(',', queue) + 1), '')
 WHERE id = ? AND queue <> '' AND SUBSTRING_INDEX(queue, ',', 1) = ?;

-- move somebody to a place (zero-based), where R is the list without them and T is how many are
-- left in it, both spelled out in full at each use — see QueueRepository
UPDATE Queue
   SET queue = CONCAT_WS(',',
           NULLIF(SUBSTRING_INDEX(R, ',', GREATEST(0, LEAST(?, T))), ''),
           ?,
           NULLIF(SUBSTRING_INDEX(R, ',', GREATEST(0, LEAST(?, T)) - T), ''))
 WHERE id = ? AND FIND_IN_SET(?, queue) > 0;
```

Both are still one statement. The move takes the entry out, cuts the remainder where it lands, and
puts the three pieces back; `CONCAT_WS` drops the NULLs, which is what stops the two ends — moved to
the very front, moved to the very back — growing a stray comma instead of an entry. The index is
clamped inside the statement rather than by the caller: an unclamped one hands `SUBSTRING_INDEX` a
positive count on both sides and duplicates the tail.

### Three places this goes wrong

1. **The guards are the safety net, not the answer.** `join` matching no rows means the queue is
   closed, *or* the caller is already in it, *or* it is full — three different chat replies out of one
   indistinguishable result. Read first, then write; the `AND` clauses only settle the race between
   the two.
2. **`!queue next` does not move the queue.** It reports the head and stops there. Moving it on is
   the dashboard's, deliberately: the queue advances when the broadcaster is actually ready, which is
   something only the person doing the thing knows.
3. **The 500 is a sanity guard, not a policy.** `TEXT` holds roughly 6500 ids before it truncates, and
   a truncated list is a corrupted list. The cap exists so a stuck client cannot get there.

## What `requirement` means

Checked by **the bot**, at `!queue join`. Sub and VIP status are already in the badges on the chat
message, so it costs no API call there; in the backend it would cost one per join. The dashboard only
sets the value.

| Value | May join |
|---|---|
| `everyone` | anyone |
| `follower` | people who follow the channel |
| `subscriber` | subscribers |
| `vip` | VIPs |

An exact check, not a floor — worth knowing before somebody reports it as a bug. On `subscriber` a VIP
who has never subscribed is turned away; on `vip` every subscriber is. The broadcaster and moderators
always get in, whatever the value.

The column is spelled in lower case and the C# enum differs only in that, so the **name** is what
carries across rather than the position (`QueueRepository.ToColumn` / `ToRequirement`, the same pair
`CustomCommandRepository` uses). Reordering either side stays harmless, and a value this build does
not know yet reads as `everyone` instead of throwing.

## How the dashboard notices

`QueueWatcher` polls every **two seconds**, and only for channels a dashboard currently has open —
with nothing watching, the query is skipped entirely. The timer ticks once a second because it renders
a countdown that has to keep step with the second it shows; a list of names does not, and nobody sees
the difference.

It compares each row's `updatedAt` against **the last value it published for that channel**, never
against its own clock. `updatedAt` is `DATETIME(3)` for the reason given in
[`subathon-timer.md`](subathon-timer.md), and it matters more here: two `!queue join` in the same
second is what a raid looks like.

Anything the dashboard does is published immediately by `QueueService`, so a click does not wait for
the next pass.

## What the dashboard receives

Unlike the wheel and the timer, **nothing here is anonymous — the reads included**. A timer hands out
a number; a queue hands out which viewers are lined up, which is other people's data. There is no
browser source that would need a way in without a session, so `GET /queue/{userId}` and
`GET /queue/{userId}/stream` are both behind the owner check, and the stream is opened with
`withCredentials`.

```json
{"type":"state","isOpen":true,"requirement":"Subscriber","entries":["12345678","87654321"]}
```

Ids, not names. The page keeps the profiles it has already looked up and asks Twitch only about ids it
has never seen, so one person joining costs one batched call and every later event costs nothing.
Resolving the whole list on each event would turn a single `!queue join` into a Helix call for
everybody already waiting.

## What the bot must not do

- **Never write `requirement`.** It is the dashboard's.
- **Never write `updatedAt`.** MariaDB maintains it; writing it by hand is how the mechanism the
  dashboard depends on gets broken.
- **Never advance the queue, and never reorder it.** `!queue next` reads. If the bot starts popping
  the head, two things are moving the same list and the broadcaster loses track of who is actually up.
  The order is changed by dragging on the dashboard, by whoever can see who is actually ready.
- **Never rebuild the list in application code.** Reading `queue`, splitting it, and writing a new
  string back is the one thing this design rules out — it reintroduces exactly the lost update the
  single-statement form exists to prevent.
- **Never put anything but numeric ids in it.** `FIND_IN_SET` and the removal expression both assume
  no commas, no spaces, no display names.

## Permissions

`!queue open`, `close`, `reset` and `clear` belong to the broadcaster and moderators. Without that
check anyone in chat can empty the queue. `join`, `leave`, `list`, `status` and `next` are everyone's.
Taking the person at the front off, and changing the order, have no chat command at all — they are
the dashboard's, behind its owner check.
The dashboard says as much under its command list, but the check itself lives in YEPPBot.

## Deployment note

`QueueHub` is an in-process singleton with no backplane, as `WheelHub` and `SubathonTimerHub` are: a
second API replica would leave half the dashboards unnotified. `docker-compose.yaml` runs one backend
container, so that holds today.

Until the YEPPBot half exists there is no way into the queue, and the page shows an empty list
whatever it does. The way to exercise it before then is to issue the statements above by hand against
the dev `helix` database and watch the dashboard follow.
