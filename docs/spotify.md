# Spotify Reference

Song requests and playback control — `backend/YEPPDash.Api/{Spotify,Repositories,Services,Controllers}/Spotify*`.

Exactly one process talks to Spotify: this backend. **YEPPBot contains no Spotify code** — no client
id, no tokens, no link parsing, no guards. It posts the raw text somebody typed and turns whatever
comes back into a chat line.

```
!spotify <text>  →  YEPPBot  →  POST /internal/spotify/{id}/request  ┐
                                                                    ├→  SongRequestService  →  Spotify
dashboard         →  POST /spotify/{id}/request                     ┘         │
                                                                              ▼
                                                              SpotifyPlaybackHub  →  SSE  →  dashboard
```

## Why the backend owns it

Three reasons, and the third is the one that would actually bite.

1. The OAuth callback needs a public HTTPS endpoint. The backend has one; the bot does not.
2. One rate-limit budget, in one place, controlled centrally.
3. **A refresh can hand back a new refresh token.** Two processes refreshing the same connection
   would each invalidate the other's, and the loser would be locked out until someone reconnected by
   hand. With one owner there is nothing to lock and nothing to race.

## Setting up the Spotify app

Spotify Developer Dashboard → new app → Web API. Since February 2026:

| Restriction | What it means here |
|---|---|
| Premium required | Player endpoints answer 403 without it — and `product` was removed from `GET /me`, so it cannot be checked in advance |
| One client id per developer | No separate dev and prod apps; use two redirect URIs on the one app |
| Five authorized users | The account that owns the app is **not** one of them — an app showing 0/5 still works for its owner. So the ceiling is six people, and every one of the other five is typed in by hand under User Management, name and email exactly as on their Spotify profile |

### The redirect URI, and the trap in it

Spotify's rules, verbatim from its own documentation:

> Use HTTPS for your redirect URI, unless you are using a loopback address, when HTTP is permitted.
> If you are using a loopback address, use the explicit IPv4 or IPv6, like `http://127.0.0.1:PORT`.
> `localhost` is not allowed as redirect URI.

`localhost` is banned as a **hostname**, not merely over HTTP — `https://localhost:7218/...` is
refused just the same. Register `http://127.0.0.1:5088/spotify/callback` for local development and
`https://api.yeppbot.com/spotify/callback` for the deployment, both on the one application.

That has a consequence worth knowing about. A browser treats `127.0.0.1` and `localhost` as different
hosts, so the callback arrives with **no cookies** — not the session, not a state cookie. This is why
`GET /spotify/callback` is `[AllowAnonymous]` and why the channel id travels inside the `state`
instead: `SpotifyConnectState` encrypts `{ channelId, returnUrl, expiry }` with the same AES-GCM key
that protects the tokens, so it is unforgeable and opaque without needing anything on the client.

The CSRF property survives. An attacker can mint a state for **their own** channel by starting a
link, but feeding it to someone else's callback links the attacker's Spotify to the attacker's own
channel and changes nothing for the victim. Minting one for a channel they do not own would mean
already holding that channel's session.

## Configuration

| Key | Required | Meaning |
|---|---|---|
| `Spotify:ClientId{DbTarget}` | no | Falls back to `Spotify:ClientId` |
| `Spotify:ClientSecret{DbTarget}` | no | Falls back to `Spotify:ClientSecret` |
| `Spotify:RedirectUri{DbTarget}` | no | Must match the app exactly. Falls back to `Spotify:RedirectUri`; defaults are in `appsettings.json` |

**Spotify is optional.** Without a client id and secret the backend still starts, every other feature
is untouched, `GET /spotify/{id}/status` answers `{ "configured": false }`, and the dashboard page
says so instead of offering a Connect button that could not work. The poller does not run either.

Scopes asked for, and nothing else — no library, no playlists, no listening history:

```
user-read-playback-state
user-modify-playback-state
user-read-currently-playing
```

## The tables

These belong to **YEPPDash**, not to the `helix` schema the subathon timer shares with the bot. The
bot never reads them — it goes through the internal HTTP API — so YEPPDash is their only writer, and
`DatabaseInitializationExtensions` creates them at startup like the other YEPPDash-owned tables.

The channel's numeric Twitch user id is the primary key throughout, the same as `SubathonTimer` and
`Wheel`. There is no foreign key to `Channel`: that table lives in the other schema, and MariaDB
cannot reference across one.

```sql
CREATE TABLE IF NOT EXISTS SpotifyConnection
(
    channelId     INT          NOT NULL PRIMARY KEY,
    spotifyUserId VARCHAR(64)  NOT NULL,
    displayName   VARCHAR(128) NOT NULL DEFAULT (''),
    refreshToken  TEXT         NOT NULL,   -- encrypted, AES-256-GCM
    accessToken   TEXT             NULL,   -- encrypted, short-lived
    expiresAt     DATETIME         NULL,
    connectedAt   DATETIME     NOT NULL,
    status        VARCHAR(16)  NOT NULL DEFAULT ('Connected')
);
```

`SpotifySettings` holds the per-channel rules, `SpotifyBlocklist` the blocked track and artist ids,
and `SongRequest` the request log — see `SpotifyRepository.CreateTableSql` for the exact DDL.

`SongRequest` is a **log, not a queue.** It has no status column because there is no lifecycle to
manage: Spotify owns the queue and offers no way to take anything back out of it. What the log is
for is attribution in the queue view, the per-user cooldown, and duplicate detection.

Tokens are encrypted with the same `ITokenCipher` that protects the Twitch tokens — one key
derivation, one place where plaintext exists.

## Internal API — what YEPPBot calls

Authenticated with the service token, not a Twitch session. It is the same value the bot already
computes for calls in the other direction: `sha256(TwitchClientSecret)`, lowercase hex, sent as
`Authorization: Bearer <token>`.

| Route | Body | Answers |
|---|---|---|
| `GET /internal/spotify/{channelId}/state` | — | `{ connected, isPlaying, track, artists, progressMs, durationMs, device }` |
| `GET /internal/spotify/{channelId}/queue?limit=5` | — | `[{ track, artists, requestedBy }]` |
| `POST /internal/spotify/{channelId}/request` | `{ input, twitchUserId, twitchUserName }` | `200 { track, artists, trackId }` or `409 { reason, retryAfterSeconds }` |
| `POST /internal/spotify/{channelId}/next` | — | `204` |
| `POST /internal/spotify/{channelId}/play` | — | `204` |
| `POST /internal/spotify/{channelId}/pause` | — | `204` |

`input` is **raw text** — a link, a URI, a bare id, or something to search for. The bot parses
nothing, which is what keeps a new Spotify link format a change in one file on one side.

### Rejections

Codes, never finished sentences: chat answers in German and the dashboard in English, and neither
should be parsing the other's prose.

| `reason` | Suggested chat line |
|---|---|
| `NOT_CONNECTED` | „Spotify ist für diesen Channel nicht verbunden." |
| `NO_DEVICE` | „Spotify läuft gerade nicht." |
| `PREMIUM_REQUIRED` | „Spotify-Steuerung nicht verfügbar." |
| `COOLDOWN` | „Noch {retryAfterSeconds}s bis zum nächsten Request." |
| `TOO_LONG` | „Track ist länger als erlaubt." |
| `DUPLICATE` | „Der Track ist schon in der Queue." |
| `BLOCKED` | „Der Track ist gesperrt." |
| `NOT_FOUND` | „Nichts gefunden." |
| `NOT_A_TRACK` | „Das ist eine Podcast-Folge, kein Song." |
| `NOT_LIVE` | „Requests gibt es nur im Livestream." |
| `DISABLED` | „Songrequests sind gerade aus." |
| `RATE_LIMITED` | „Spotify bremst gerade — gleich nochmal." |
| timeout | „Spotify antwortet gerade nicht." |

`retryAfterSeconds` is only set for `COOLDOWN` and `RATE_LIMITED`, where waiting is actionable
advice rather than a shrug.

**Give the bot a 3 s timeout.** A backend that has stopped answering should produce a chat line, not
a command that hangs.

### What stays on the bot's side

Role checks. The bot already knows who is a broadcaster or a moderator; this API has no way to find
out. `!spotify`, `!spotify queue` and `!spotify <link|search>` are for everyone; `skip`, `play` and
`pause` are not.

## Guards

All in `SongRequestService`, and deliberately not in the bot: the dashboard reaches the same queue by
a different route, and a limit the dashboard can walk around is not a limit.

| Guard | Applies to |
|---|---|
| Requests enabled | chat only |
| Per-user cooldown | chat only |
| Maximum track length | chat only |
| Live-stream-only | chat only |
| Blocklist (track and artist) | everyone |
| Duplicate against the queue and the current track | everyone |
| Tracks only, no podcast episodes | everyone |

The split is that the first four hold *chat* back — the broadcaster set them for their viewers, not
for themselves — while the rest say "not this track" rather than "not this often".

The live check runs last of the three chat guards on purpose: it is the only one that costs a call to
Twitch, and by then the cooldown has already capped how often it can happen. If Twitch is
unreachable the request is let through rather than refused — one outage should not become two.

## Live updates

`SpotifyPlaybackWatcher` polls `GetCurrentPlayback` every 5 s, **only for channels with a dashboard
open**, and pushes over SSE only when something actually changed. Progress deliberately does not
count as a change: it moves every tick by definition, and the page extrapolates it locally between
pushes. The queue is re-read when the track changes, and otherwise at most every 30 s.

Commands from either controller publish immediately as well, so a button does not appear to do
nothing for five seconds. The duplicate push is harmless because every payload is whole state rather
than a delta.

Unlike the wheel's and the timer's streams, `GET /spotify/{id}/stream` is **not** anonymous — it
carries what a private account is listening to — so it runs under the session cookie with the same
owner check as the rest of the controller.

## The overlay link

`/spotify/overlay?channel=<id>` is an OBS browser source, and like the wheel's and the timer's it is
anonymous — a browser source carries no session, and the link has to work on whatever machine is
streaming.

That is why it is a **narrower feed rather than the same one**. `SpotifyEvents.ForOverlay` sends the
track, the artists, the cover and the progress, and stops there:

```json
{"type":"playback","isPlaying":true,
 "track":{"id":"…","name":"CRAZY","artists":"LE SSERAFIM","durationMs":164554,"artworkUrl":"…"},
 "progressMs":30382}
```

No device name — that is whatever a speaker or a phone is called, which is very often a person's own
name — and no queue, because the queue carries requester names. `SpotifyEvents.ForDashboard` is the
one that sends both, behind the session cookie.

`SpotifyPlaybackHub` therefore carries the **event**, not a finished string: one poll, two audiences,
each serializing what it is allowed to. That is also why `ChannelEventHub` is generic.

The hub keeps the last event per channel and hands it to a new subscriber before waiting for the next
change. Subscribing is itself what makes the poller start looking at a channel, so without that a
browser source added mid-stream would sit blank until something happened to change. A push carrying
no queue leaves the previously retained one standing, so what gets replayed is never a state whose
queue merely looked empty.

The card hides itself when nothing is playing rather than painting an empty rectangle, and everything
about its look is a CSS custom property on `:host` — the dashboard's "Copy custom CSS" button hands
over the defaults as a starting point for OBS's own box.

## What this deliberately does not do

- **Remove or reorder the queue.** Spotify has no endpoint for it. Doing it anyway would mean holding
  a shadow queue and pushing tracks one at a time on a timer — a different architecture, not a
  feature to add later.
- **Check for Premium up front.** No longer possible; it surfaces as a 403 on the first command.
- **Run for anyone who asks.** Six accounts is the hard ceiling: the owner plus five, entered by
  hand. Extended Quota Mode is the only way past it, and community reports put the bar at 250,000
  monthly active users with reviews largely suspended — a catch-22, since Development Mode caps you
  at five. Long-standing integrations that do this publicly, such as the VS Code Spotify extension,
  were granted extended quota under the older rules.

  The way around it, deliberately **not** taken here, is to let each broadcaster register their own
  Spotify application and store their client id and secret per channel. That works — every
  broadcaster is then their own developer with their own allowance — at the cost of five minutes of
  setup each, holding other people's client secrets, and being an evident circumvention of a limit
  Spotify set on purpose.
- **Volume, shuffle, repeat, seek, device transfer, playlists, library, recently played.**

## If the library has to go

`SpotifyAPI.Web` is a single-maintainer project. It kept up with the February 2026 changes within a
month, but that is not something to rely on. `ISpotifyPlaybackService` is the entire contact surface:
everything above it deals in `SpotifyTrack` and the exceptions in `Exceptions/Spotify`, never in
Spotify's own types or status codes. Replacing the library means rewriting one class.

The same interface is what makes the guards and the bot commands testable — a fake of it needs no
Premium account and no music actually playing.
