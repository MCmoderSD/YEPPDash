# YEPPDash

Web dashboard for [YEPPBot](https://github.com/MCmoderSD/YEPPBot) — a monolithic Twitch chat bot with no interactive console of its own. YEPPDash lets broadcasters control YEPPBot from a browser instead of only via Twitch chat commands, without weakening the bot's security posture: end users never talk to the bot directly, only to this dashboard's backend.

Status: early beta, actively developed. Twitch login, moderator/VIP/editor management, letting the bot join/leave your channel, custom commands, quote management, follower birthdays, BDSM test results, auto-shoutouts for raiders, a channel point reward that buys a timeout, and two OBS overlays (a lucky wheel and a subathon timer) are live. The UI, and the feature set, are still changing.

## Features

- **Twitch login** — OAuth2 against Twitch, no separate account/password
- **Bot management** — see the bot's status in your channel (banned/blocked/moderator/in chat) and join/leave it
- **Role management** — add/remove moderators and VIPs, view editors, followers, banned and blocked users
- **Custom commands** — add, edit, and toggle chat commands, with a live reload of the running bot
- **Quote management** — add, edit, reorder, and bulk import/export quotes as Excel
- **Follower birthdays** — track and view your community's birthdays
- **BDSM test results** — view your own and your followers' results
- **Lucky wheel** — build a wheel of entries and spin it, live on an OBS browser source
- **Subathon timer** — a countdown OBS shows and chat drives, with the appearance set from the dashboard
- **Queue** — a waiting list chat joins from and the dashboard works through, in order (the dashboard half; the `!queue` commands are not in YEPPBot yet, so nothing can join it today)
- **Auto-shoutouts** — shout out whoever raids you, without touching chat yourself
- **Timeout reward** — a channel point reward viewers redeem by typing a name, which times that viewer out for as long as you set; unknown names and the roles you protect are refunded automatically

## Tech Stack

| | |
|---|---|
| Backend | ASP.NET Core 10 (C#), MVC Controllers, Dapper + MySqlConnector, ClosedXML |
| Frontend | Angular 22 + Angular Material, SSR (`@angular/ssr` + Express) |
| Auth | Twitch OAuth2 (authorization code) + Helix `/users` — no local passwords/user table |
| Database | Shared MariaDB (`helix` schema), owned and migrated by YEPPBot, plus YEPPDash's own `TwitchToken`, `Wheel`, `TimeoutReward`, `RoleRestore` and `RedemptionLog` tables |
| Twitch events | EventSub over WebSocket, one connection per broadcaster — every EventSub limit is counted per client id and user id together |
| Live updates | Server-Sent Events, one in-process hub per feature — assumes a single backend instance, which `docker-compose.yaml` runs |
| Reverse proxy | Caddy, run by the operator outside this repo — subdomain routing (`dash.yeppbot.com`/`.dev` → frontend, `api.yeppbot.com`/`.dev` → backend) |

## Repository Structure

```
YEPPDash/
├── backend/           # ASP.NET Core 10 Web API (Rider project)
├── frontend/          # Angular 22 + Material SSR app (WebStorm project)
├── docs/              # API client docs
├── docker-compose.yaml # local dev only: backend + frontend, ports published directly, no reverse proxy
└── .env.example        # template for the gitignored .env (DB connection strings)
```

Reverse proxying (Caddy) is not part of this repo — it's handled by the operator's separate, existing Caddy setup, which routes `dash.yeppbot.com`/`.dev` to the frontend and `api.yeppbot.com`/`.dev` to the backend.

`backend/` and `frontend/` are independent IDE project roots (Rider / WebStorm respectively) inside this one repository.

## Documentation

- [`docs/twitch-api-client.md`](docs/twitch-api-client.md) — endpoints and features of the two Twitch API wrappers (Helix + OAuth)
- [`docs/yeppbot-api-client.md`](docs/yeppbot-api-client.md) — the HTTP client YEPPDash uses to talk to a running YEPPBot instance (join/leave a channel, reload custom commands)
- [`docs/subathon-timer.md`](docs/subathon-timer.md) — the table the subathon timer shares with YEPPBot: the statements each chat command is, and what either side must not touch
- [`docs/queue.md`](docs/queue.md) — the same for the queue: why the waiting list is one text column, and which half owns which command

## Relationship to YEPPBot

Actions that change how the running bot behaves — join/leave a channel, reload custom commands — go through a small HTTP API on YEPPBot itself rather than being written into its state behind its back; see [`docs/yeppbot-api-client.md`](docs/yeppbot-api-client.md) for the contract. That keeps YEPPBot's inputs to "its own HTTP API" and "the Twitch API," matching its existing security model.

The subathon timer and the queue are the exceptions, and deliberately so: both sides write the same row of one shared table, with no call in either direction. There is nothing to reload — the row *is* the state, and the bot reads it when it answers a command. [`docs/subathon-timer.md`](docs/subathon-timer.md) and [`docs/queue.md`](docs/queue.md) are the contracts that keep those halves in step.

## License

BSD 3-Clause — see [`LICENSE`](LICENSE).