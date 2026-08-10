# YEPPDash

Web dashboard for [YEPPBot](https://github.com/MCmoderSD/YEPPBot) — a monolithic Twitch chat bot with no interactive console of its own. YEPPDash lets broadcasters control YEPPBot from a browser instead of only via Twitch chat commands, without weakening the bot's security posture: end users never talk to the bot directly, only to this dashboard's backend.

Status: early beta, actively developed. Twitch login, moderator/VIP/editor management, letting the bot join/leave your channel, custom commands, quote management, follower birthdays, and BDSM test results are live. The UI, and the feature set, are still changing.

## Features

- **Twitch login** — OAuth2 against Twitch, no separate account/password
- **Bot management** — see the bot's status in your channel (banned/blocked/moderator/in chat) and join/leave it
- **Role management** — add/remove moderators and VIPs, view editors, followers, banned and blocked users
- **Custom commands** — add, edit, and toggle chat commands, with a live reload of the running bot
- **Quote management** — add, edit, reorder, and bulk import/export quotes as Excel
- **Follower birthdays** — track and view your community's birthdays
- **BDSM test results** — view your own and your followers' results

## Tech Stack

| | |
|---|---|
| Backend | ASP.NET Core 10 (C#), MVC Controllers, Dapper + MySqlConnector, ClosedXML |
| Frontend | Angular 22 + Angular Material, SSR (`@angular/ssr` + Express) |
| Auth | Twitch OAuth2 (authorization code) + Helix `/users` — no local passwords/user table |
| Database | Shared MariaDB (`helix` schema), owned and migrated by YEPPBot, plus YEPPDash's own `TwitchToken` table for encrypted OAuth tokens |
| Reverse proxy | Caddy, run by the operator outside this repo — subdomain routing (`dash.yeppbot.com`/`.dev` → frontend, `api.yeppbot.com`/`.dev` → backend) |

## Repository Structure

```
YEPPDash/
├── backend/           # ASP.NET Core 10 Web API (Rider project)
├── frontend/          # Angular 22 + Material SSR app (WebStorm project)
├── docs/              # API client docs
├── docker-compose.yml # local dev only: backend + frontend, ports published directly, no reverse proxy
└── .env.example       # template for the gitignored .env (DB connection strings)
```

Reverse proxying (Caddy) is not part of this repo — it's handled by the operator's separate, existing Caddy setup, which routes `dash.yeppbot.com`/`.dev` to the frontend and `api.yeppbot.com`/`.dev` to the backend.

`backend/` and `frontend/` are independent IDE project roots (Rider / WebStorm respectively) inside this one repository.

## Documentation

- [`docs/twitch-api-client.md`](docs/twitch-api-client.md) — endpoints and features of the two Twitch API wrappers (Helix + OAuth)
- [`docs/yeppbot-api-client.md`](docs/yeppbot-api-client.md) — the HTTP client YEPPDash uses to talk to a running YEPPBot instance (join/leave a channel, reload custom commands)

## Relationship to YEPPBot

YEPPDash never writes bot-affecting state directly to the database. Actions that affect the running bot (join/leave a channel, reload custom commands) go through a small HTTP API on YEPPBot itself — see [`docs/yeppbot-api-client.md`](docs/yeppbot-api-client.md) for the contract. This keeps YEPPBot's only inputs as "its own HTTP API" and "the Twitch API," matching its existing security model.

## License

BSD 3-Clause — see [`LICENSE`](LICENSE).