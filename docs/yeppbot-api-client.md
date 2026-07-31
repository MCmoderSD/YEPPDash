# YEPPBot API Client Reference

How the dashboard talks to a **running YEPPBot** — `backend/YEPPDash.Api/Bot/`.

This is the one place the dashboard reaches the bot process itself rather than the database they share.
Everything else is one-way: YEPPDash writes to the `helix` schema and the bot reads it on its own schedule.
These routes are what make a change take effect now instead of at the bot's next restart.

```
frontend BotService  →  backend /bot/*  →  YeppBotClient  →  YEPPBot
                        CustomCommandService ↗
```

## Configuration

| Key | Required | Meaning |
|---|---|---|
| `YeppBot:BaseUrl{DbTarget}` | no | The bot's API root, e.g. `https://home.example.de:420/api`. Falls back to `YeppBot:BaseUrl` |
| `YeppBot:AllowUntrustedCertificate{DbTarget}` | no | Accept the bot's TLS certificate without validating it. Falls back to the unsuffixed key. Default `false` |

`{DbTarget}` is the same suffix the rest of the config uses (`Dev`/`Prod`), so a dev dashboard can point at a dev bot.

**The bot is optional.** With no base URL configured the client reports itself unconfigured, every call
becomes a no-op, and the dashboard keeps working — only the "tell the bot" step goes quiet. That is
deliberate: the database writes are the source of truth, and the bot picks them up on restart regardless.

### Authentication

There is no separate API key. Both sides derive it from the Twitch application client secret they already share:

```
Authorization: Bearer <lowercase hex SHA-256 of Twitch:ClientSecret{DbTarget}>
```

Nothing new has to be configured or rotated for the bot link — it follows the client secret.

### Self-signed certificates

The bot often runs on a private host behind a self-signed certificate. `AllowUntrustedCertificate`
turns off validation **for this one client only**, through its own primary handler, so nothing else in
the app loses certificate checking. It is off unless asked for; prefer a certificate the dashboard's
host trusts where that is possible.

## `YeppBotClient`

All three endpoints are POST, take the channel's numeric Twitch user id as the last path segment, send
no body, and answer `{ success, status, message }`.

| Method | Endpoint | Notes |
|---|---|---|
| `JoinChannelAsync` | `POST api/JoinChannel/{channelId}` | Idempotent — already joined still answers 200 |
| `LeaveChannelAsync` | `POST api/LeaveChannel/{channelId}` | |
| `UpdateCustomCommandsAsync` | `POST api/UpdateCustomCommands/{channelId}` | Reload is asynchronous on the bot's side: success means it started, not that it finished |

`{channelId}` is the **channel owner's** id, not the bot's. Anything that is not a positive integer is
refused before a request is spent on it, matching the 400 the bot would answer with.

### Failure handling

Nothing here throws for a bot that is down, unconfigured, or refusing the call. Every path answers a
`YeppBotResult`, because by the time most of these run the dashboard's own work has already committed:

| Situation | `Success` | `Status` |
|---|---|---|
| Bot answered | its own | its own |
| Bot unreachable, or no bot configured | `false` | `YeppBotResult.Unreachable` (`0`) |
| Non-JSON body (a proxy error page) | from the status line | the HTTP status |

A caller cancelling still cancels — that is the dashboard giving up, not the bot failing.

## Dashboard surface

| Route | Calls | Guard |
|---|---|---|
| `POST /bot/{userId}/join` | `JoinChannelAsync` | Owner-only: the session may only move the bot in its own channel |
| `POST /bot/{userId}/leave` | `LeaveChannelAsync` | Owner-only |

The bot's status travels to the browser where it is one the caller can act on. A `401`/`403` from the
bot is **not** passed through — that means the dashboard's own key is wrong, which is an operator
problem rather than something to ask the reader to log in again over, so it is logged as an error and
reported as `502`.

### Command reloads

`CustomCommandService` calls `UpdateCustomCommandsAsync` after every write that changes what the bot
should answer — add, update, delete, and the active toggle. It is best effort and never fails the edit:
the write has already committed, so a bot that cannot be reached only means it answers with the old
command until it is asked again or restarted. That is a log line, not an error for the channel to act on.
