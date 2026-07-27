# YEPPDash

Web dashboard for [YEPPBot](https://github.com/MCmoderSD/YEPPBot) — a monolithic Twitch chat bot with no interactive console of its own. YEPPDash lets broadcasters control YEPPBot from a browser (starting with adding/removing the bot from their channel) instead of only via Twitch chat commands, without weakening the bot's security posture: end users never talk to the bot directly, only to this dashboard's backend.

Status: early development, pre-Phase 1. See [`ROADMAP.md`](ROADMAP.md) for current progress.

## Tech Stack

| | |
|---|---|
| Backend | ASP.NET Core 10 (C#), Minimal APIs, Dapper + MySqlConnector |
| Frontend | Angular 22 + Angular Material, SSR (`@angular/ssr` + Express) |
| Auth | Twitch as OIDC identity provider — no local passwords/user table |
| Database | Shared MariaDB (`helix` schema), owned and migrated by YEPPBot; this repo reads with a least-privilege, SELECT-only user |
| Reverse proxy | Caddy — single origin (`yeppbot.com`), path-based routing (`/` → frontend, `/api/*` → backend) |

## Repository Structure

```
YEPPDash/
├── backend/     # ASP.NET Core 10 Web API (Rider project)
├── frontend/    # Angular 22 + Material SSR app (WebStorm project)
├── infra/       # Caddyfile, dev DB seed scripts
└── docker-compose.yml
```

`backend/` and `frontend/` are independent IDE project roots (Rider / WebStorm respectively) inside this one repository — see [`PLAN.md`](PLAN.md#repository-structure) for why they're kept separate.

## Documentation

- [`PLAN.md`](PLAN.md) — architecture, design decisions and their rationale, API contracts, deployment approach
- [`ROADMAP.md`](ROADMAP.md) — ordered, checkable implementation steps

## Relationship to YEPPBot

YEPPDash never writes bot-affecting state directly to the database. All actions that affect the running bot (e.g. join/leave a channel) go through a dedicated internal API on YEPPBot itself — see [`PLAN.md`](PLAN.md#internal-bot-interface-contract-now-implementation-deferred) for the contract. This keeps YEPPBot's only inputs as "its own internal API" and "the Twitch API," matching its existing security model.

## License

BSD 3-Clause — see [`LICENSE`](LICENSE).
