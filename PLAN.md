# YEPPDash — Implementation Plan

## Context

YEPPBot (`C:\Users\MCmoderSD\IdeaProjects\Current\YEPPBot`, Java 25/Maven) is a monolithic Twitch chat bot with a MariaDB backend (`helix` schema) and **no interactive console or admin UI** — the only ways to control it today are Twitch chat commands, the Twitch API, and direct database edits. That's intentional: it keeps the bot's attack surface small. The goal now is to give broadcasters a proper web dashboard (like StreamElements has for its bot) to control YEPPBot functions, starting with adding/removing the bot from their channel, without weakening that security posture.

Key constraint discovered while exploring YEPPBot: **the bot reads its `Channel` table exactly once, at startup** — there is no polling loop or live-update mechanism. Writing `Channel.active=1` to the database from a dashboard would silently do nothing to the running bot. The bot's real join logic lives in `TwitchBot.joinChannel(TwitchUser)`/`leaveChannel(TwitchUser)` (`src/main/java/de/MCmoderSD/core/TwitchBot.java:422-480`), which calls the live Twitch4J chat client **and then** persists the DB flag. This confirms the user's own design intent: the dashboard backend must talk to a real interface on YEPPBot (not just the shared database) for any bot-affecting action, keeping YEPPBot's only inputs as "its own internal API" + "the Twitch API."

The bot already has an idle, reusable HTTP(S) server (`de.MCmoderSD:HTTPS-Server`, wraps Undertow, `Server.registerPrefixPath(...)`), currently only serving one static OAuth-callback page (`Main.java:108-111`) — the natural place to add a small internal join/leave/status API later.

Outcome of this plan: a new standalone repo, `YEPPDash`, with an ASP.NET Core 10 backend and an Angular 22 + Material frontend, authenticating end users exclusively via Twitch (their Twitch ID doubles as the primary key already used in YEPPBot's `User`/`Channel` tables — no separate identity mapping needed), reading channel status read-only from the shared MariaDB, and — once a **separate, later** YEPPBot-side change adds the internal API — driving join/leave through it instead of the database directly.

**Explicitly deferred by the user**: the YEPPBot-side companion API (new Java HTTP handler) is *not* part of this engagement. This plan documents the contract the backend needs, and the backend is built against an abstraction (`IBotClient`) with a stub implementation so dashboard development isn't blocked on that separate work. Command management (beyond join/leave) is also out of scope for v1.

---

## Architecture Overview

All three diagrams below are also available as editable scenes in [`docs/diagrams/`](docs/diagrams) (`architecture.excalidraw`, `auth-flow.excalidraw`, `join-flow.excalidraw`) — open them at [excalidraw.com](https://excalidraw.com) for a version you can rearrange, annotate, or export from directly.

```mermaid
flowchart LR
    Browser["Browser"] -->|"https://dash.yeppbot.com/.dev"| Proxy["Caddy<br/>(operator's existing reverse-proxy setup,<br/>NOT part of this repo)"]
    Browser -->|"https://api.yeppbot.com/.dev"| Proxy
    Proxy -->|"dash.* -> :4000"| FE["YEPPDash Frontend<br/>Angular 22 SSR + Material<br/>(Express runtime, like MCmoderSD.de)"]
    Proxy -->|"api.* -> :8080"| BE["YEPPDash Backend<br/>ASP.NET Core 10"]
    BE -->|"SELECT-only, least-priv user"| DB[("MariaDB `helix`<br/>owned by YEPPBot")]
    BE -->|"OIDC/OAuth login"| Twitch["Twitch<br/>(Identity Provider)"]
    BE -.->|"internal API (deferred)<br/>shared-secret header"| Bot["YEPPBot<br/>(Java, Twitch4J)"]
    Bot -->|"full read/write"| DB
    Bot -->|"bot-account token"| Twitch
```

Note: `dash.` and `api.` are separate subdomains (not path prefixes on one origin), so frontend↔backend calls are cross-origin from the browser's point of view — see [Auth](#auth) and [Deployment](#deployment) for what that changes.

```mermaid
sequenceDiagram
    participant U as Browser
    participant P as Caddy (operator's setup)
    participant BE as YEPPDash Backend (api.yeppbot.*)
    participant T as Twitch (OAuth2 + Helix)

    U->>P: GET api.yeppbot.com/api/auth/login
    P->>BE: forward
    BE->>BE: issue state nonce + state cookie
    BE-->>U: 302 -> Twitch authorize (bot scope set, state)
    U->>T: authenticate & consent
    T-->>U: 302 -> api.yeppbot.com/api/auth/callback?code=&state=
    U->>P: GET /api/auth/callback
    P->>BE: forward
    BE->>BE: validate state against cookie (CSRF)
    BE->>T: POST /oauth2/token (code, server-to-server)
    T-->>BE: access_token + refresh_token + granted scopes
    BE->>T: GET /helix/users (Bearer access_token)
    T-->>BE: id, login, display_name, email, profile_image_url
    BE->>BE: encrypt + store token, SignInAsync (httpOnly cookie)
    BE-->>U: 302 -> dash.yeppbot.com (cookie set)
    U->>P: GET dash.yeppbot.com, then GET api.yeppbot.com/api/auth/me (CORS, credentials: include)
    P->>BE: forward
    BE->>T: GET /helix/users (fresh profile on every call)
    BE-->>U: 200 {twitchId, login, displayName, email, profileImageUrl}
```

```mermaid
sequenceDiagram
    participant U as Browser (dash.yeppbot.*)
    participant BE as YEPPDash Backend (api.yeppbot.*)
    participant IB as IBotClient (stub now, real later)
    participant Bot as YEPPBot internal API

    U->>BE: POST /api/channel/join (cookie auth)
    BE->>BE: derive twitchUserId from auth claim
    BE->>IB: JoinAsync(twitchUserId)
    alt stub (Phase 2, before YEPPBot change ships)
        IB-->>BE: fake success response
    else real (once YEPPBot internal API exists)
        IB->>Bot: POST /internal/api/v1/channel/join {twitchUserId} + X-Internal-Api-Key
        Bot->>Bot: TwitchBot.joinChannel(user) — live chat join + DB write
        Bot-->>IB: {active:true, joinedLiveChat:true}
    end
    IB-->>BE: result
    BE-->>U: 200 {active:true}
```

---

## Repository Structure

Monorepo at `C:\Users\MCmoderSD\Desktop\YEPPDash` (not yet a git repo — `git init` is step 1):

```
YEPPDash/
├── docker-compose.yml          # local only: backend + frontend, published directly on :8080/:4000 — no reverse proxy in this repo
├── .env.example                 # DB_TARGET + both HelixDev/HelixProd connection strings (real values in gitignored .env)
├── backend/
│   ├── YEPPDash.slnx            # XML solution format (Rider/.NET 10) — cleaner git diffs than classic .sln
│   ├── global.json
│   ├── YEPPDash.Api/            # sibling to the .slnx, standard .NET layout (no extra src/ nesting)
│   │   ├── Program.cs           # composition root only — builder/DI wiring, no endpoint/business logic
│   │   ├── Auth/            # AddYeppDashAuth (cookie scheme), state cookie, token store + AES-GCM cipher, claim types
│   │   ├── Twitch/          # TwitchOAuthClient (id.twitch.tv), TwitchApiClient (Helix), scopes + options
│   │   ├── Controllers/     # MVC controllers — AuthController.cs ([ApiController]/[Route]/[Http*] attribute routing); ChannelController.cs in Phase 2
│   │   ├── Services/        # business logic between controllers and clients/repositories — TwitchAuthService.cs
│   │   ├── Data/            # AddYeppDashDatabase, DatabaseHealthCheck, BitBoolTypeHandler, DatabaseTwitchTokenStore; ChannelRepository/UserRepository once a feature needs one (Phase 2)
│   │   ├── Contracts/       # request/response DTOs (UserInfo, TwitchUser, TwitchTokenResponse, ...)
│   │   ├── Helpers/         # cross-cutting extensions (ConfigurationExtensions, ClaimsPrincipalExtensions)
│   │   ├── BotClient/       # IBotClient + HttpBotClient + StubBotClient — Phase 2
│   │   └── Options/         # TwitchOptions, BotApiOptions, DatabaseOptions — once there's config worth binding to a type
│   └── YEPPDash.Api.Tests/
└── frontend/
    └── src/app/
        ├── core/auth/            # auth.service.ts, auth.guard.ts, auth.interceptor.ts
        ├── core/channel/         # channel.service.ts
        ├── features/landing/     # "/" — Login with Twitch
        ├── features/dash/        # "/dash" — join/leave card
        └── shared/material-theme/  # generated M3 theme + brand overrides
```

---

## Backend Design (ASP.NET Core 10)

### Auth
Plain **OAuth2 authorization code flow**, driven by hand against `https://id.twitch.tv/oauth2/*` — no OIDC middleware, no `openid` scope, no `id_token`. Identity comes from `GET /helix/users` with the freshly obtained access token, which returns exactly the `id` / `login` / `display_name` / `email` / `profile_image_url` the dashboard needs.

**Why not OIDC** (it was implemented first and then replaced, see [ROADMAP.md](ROADMAP.md#phase-1b--von-oidc-auf-direktes-oauth2)): the dashboard has to hold a broadcaster access token anyway to manage the bot's moderator status, to detect a banned/blocked bot, and to join/leave a channel. OIDC delivered identity in a second, separate mechanism on top of that token — two flows where one suffices. On top of that, Twitch's OIDC implementation needed three workarounds (non-standard discovery path, a `claims` request parameter for `email`/`preferred_username`, `response_mode=query`) that all disappear with the plain flow. The only thing given up is the signed `id_token`; the identity is now asserted by a server-to-server TLS call to Helix instead, which is at least as trustworthy.

**Scopes**: the exact sets YEPPBot's own two Twitch apps request, picked by `DbTarget` (`TwitchScopes.For`). Prod asks for the 13 scopes the bot actually needs in production; Dev asks for Twitch's complete catalogue (80 scopes) so new bot features can be tried out without a re-authorization round. Dashboard and bot share one app per environment, so a single consent covers both — a user who logs into the dashboard has thereby granted the bot everything it needs.

**Sessions**: cookie authentication (`yeppdash.session`, httpOnly, Secure, `SameSite=Lax`, 14 days sliding), registered as the *only* scheme. There is no challenge scheme, so an unauthenticated request can never accidentally trigger a redirect to Twitch — `/api/auth/login` is the single entry point into the flow. `SameSite=Lax` works everywhere because frontend and backend share a registrable domain (`dash.`/`api.yeppbot.com` in production, `localhost` in development) and the OAuth callback is a top-level GET.

The cookie only carries `twitch_id` (plus `twitch_login` as an offline display fallback). Everything else is re-read from Helix on every `/api/auth/me`, because only the ID is stable — logins, display names, avatars and e-mail addresses all change. The Twitch user ID is also the PK of YEPPBot's `User`/`Channel` tables, so no mapping table is needed.

**CSRF**: the `state` parameter is owned by the app now that the middleware no longer provides it. A 32-byte random nonce goes into the authorize URL and, together with the return URL, into a short-lived (10 min) httpOnly state cookie; the callback compares them in constant time and consumes the cookie either way. The return URL never travels through Twitch and is additionally validated against `AllowedFrontendOrigins`.

**Token storage**: access and refresh token land in `TwitchToken` in YEPPDash's *own* database, AES-256-GCM encrypted with a key derived from the Twitch client secret (`AesGcmTokenCipher`) — one secret for the whole deployment, no separate key management, and rotating the client secret invalidates all stored tokens exactly as it does for the bot. `TwitchAuthService.GetValidTokenAsync` refreshes transparently 5 minutes before expiry and replaces the stored row, since Twitch may hand back a new refresh token. Without a configured `ConnectionStrings:YeppDash{DbTarget}` the backend falls back to an in-memory store and logs a warning, so a fresh clone can run the login flow before any database work happens.

> **Deliberately *not* shared with the bot**: YEPPBot keeps its own tokens in `helix.RefreshToken` (encrypted AES-ECB with SHA3-256 of the client secret, see `Helix-API/SQL.java`). Writing into that table would provision the bot from a dashboard login, but both processes would then share one refresh token per user — and because Twitch rotates the refresh token on use, whichever side refreshes second gets rejected. Separate tokens per process avoids that race. Handing tokens over to the bot is a Phase 2 topic and, if it happens, belongs in the bot's internal API rather than in a shared table.

**Twitch application**: YEPPDash doesn't register its own Twitch app — it reuses YEPPBot's existing Dev and Prod apps (same `clientId`/`clientSecret` the bot itself already uses for its own OAuth flow), since dashboard and bot are the same product/identity. Credentials for both are stored as `Twitch:ClientIdDev`/`ClientSecretDev` and `Twitch:ClientIdProd`/`ClientSecretProd` via `dotnet user-secrets` locally, mirroring the `ConnectionStrings:HelixDev`/`HelixProd` pattern — never committed. Twitch apps accept multiple registered OAuth redirect URLs, so YEPPDash's callback(s) are *added* alongside the bot's existing `https://home.mcmodersd.de:420/callback`, not a replacement for it. Needed additions (one Twitch Developer Console change per environment, done by the operator, not by this repo):

| Environment | Redirect URI to add |
|---|---|
| Local dev | `https://localhost:7218/api/auth/callback` (Kestrel's own HTTPS port from `launchSettings.json`, backend run directly via `dotnet run`/Rider — no Docker, no Caddy; port 8080 was already in use on the dev machine) |
| Prod (once deployed) | `https://api.yeppbot.com/api/auth/callback` |
| Dev (once deployed) | `https://api.yeppbot.dev/api/auth/callback` |

**Cross-origin implication of the subdomain split**: `dash.yeppbot.com` and `api.yeppbot.com` are two different origins to the browser (different host), even though they're the same registrable domain — `SameSite=Lax` still ships the cookie (subdomains are "same-site"), but the frontend's `fetch()` calls to the API are now genuinely cross-origin and require CORS. Backend needs `AddCors` with an explicit allowlist (`https://dash.yeppbot.com`, `https://dash.yeppbot.dev`, plus local dev origins) and `AllowCredentials()`; frontend's `HttpClient` calls need `withCredentials: true` (Angular's `withFetch()` + `credentials: 'include'`). This wasn't needed under the old single-origin, path-routed design — it's a direct consequence of moving to `dash.*`/`api.*` subdomains.

### Database access
Dapper + `MySqlConnector`, deliberately **not** EF Core — the `helix` schema is owned and migrated solely by YEPPBot's own `CREATE TABLE IF NOT EXISTS` scripts, and `User.user` is an LZ4-compressed Java-serialized blob that's undecodable from C# and must simply never be selected. Backend DB user (`yeppdash_ro`) gets **SELECT-only** grants on `User`/`Channel` — no write grants at all, so "all mutations go through the bot" is enforced by the database, not just convention. Confirmed in Phase 0: MySqlConnector maps `BIT(1)` columns (`Channel.active`/`autoShoutout`) as `UInt64`, not `bool` — a `BitBoolTypeHandler` registered once in `Program.cs` fixes this for every query.

There is no dedicated local/dev-only database — the app always talks to one of the two real MariaDB servers the bot already uses: Dev (`10.10.10.1`) and Prod (`dedi.mcmodersd.de`). Both connection strings (`ConnectionStrings:HelixDev`/`ConnectionStrings:HelixProd`) are always configured; a `DbTarget` setting (`Dev` or `Prod`, default `Dev`) picks which one is actually used, so the same container image can point at either without a rebuild. A separate `YEPPDash` database (own schema, not `helix`) exists on both servers for dashboard-specific state, with a full-access app user. It is reached through its own connection string (`ConnectionStrings:YeppDashDev`/`YeppDashProd`) and its own `YeppDashConnectionFactory`, deliberately kept apart from the read-only `helix` connection so the two access levels cannot be mixed up. `TwitchToken` (encrypted Twitch tokens, see [Auth](#auth)) is the first table living there; it is created on startup via `CREATE TABLE IF NOT EXISTS`, the same self-provisioning approach Helix-API uses.

### Internal Bot interface (contract now, implementation deferred)
Backend defines `IBotClient` with `GetStatusAsync`, `JoinAsync`, `LeaveAsync(twitchUserId)`. Two implementations: `StubBotClient` (in-memory fake, used until the YEPPBot-side API exists — lets Phase 2 ship a working UI demo now) and `HttpBotClient` (typed `HttpClient` + Polly retry, calling the documented contract below once it's built on the YEPPBot side, separately). Swap via config/DI — no code changes needed in `Endpoints/` when the switch happens.

Documented target contract (for whoever implements the YEPPBot side later):

| Method & Path | Auth | Body | 200 Response |
|---|---|---|---|
| `GET /internal/api/v1/health` | `X-Internal-Api-Key` | — | `{"status":"ok"}` |
| `GET /internal/api/v1/channel/status/{twitchUserId}` | header | — | `{"channelId":123,"active":true,"joinedLiveChat":true}` |
| `POST /internal/api/v1/channel/join` | header | `{"twitchUserId":123}` | `{"channelId":123,"active":true,"joinedLiveChat":true}` |
| `POST /internal/api/v1/channel/leave` | header | `{"twitchUserId":123}` | `{"channelId":123,"active":false,"joinedLiveChat":false}` |

The shared-secret header is required **regardless of network topology** (see Deployment) — the user wants the option to split backend and bot across hosts later, so auth can't rely on network isolation alone.

### Public API (v1)

| Method & Path | Auth | Purpose |
|---|---|---|
| `GET /api/auth/login` | anon | 302 → Twitch authorize |
| `GET /api/auth/callback` | anon | completes login, sets cookie, 302 → `dash.yeppbot.*` |
| `POST /api/auth/logout` | cookie | clears cookie |
| `GET /api/auth/me` | cookie | `{twitchId, login, displayName, profileImageUrl}` |
| `GET /api/channel/status` | cookie | via `IBotClient`, for caller's own Twitch ID |
| `POST /api/channel/join` | cookie | via `IBotClient` |
| `POST /api/channel/leave` | cookie | via `IBotClient` |
| `GET /api/twitch/chat-color/{userId?}` | cookie | `{id, color}` from Helix, caller's own when `userId` is omitted |
| `GET /api/twitch/users?id=&login=` | cookie | Helix get users, up to 100 ids/logins mixed per call |
| `GET /api/twitch/moderators` | cookie | full moderator list, paginated + cached (`moderation:read`) |
| `GET /api/twitch/vips` | cookie | full VIP list, paginated + cached (`channel:read:vips`) |
| `POST /api/twitch/moderators/{userId}` | cookie | Helix add channel moderator (`channel:manage:moderators`) |
| `DELETE /api/twitch/moderators/{userId}` | cookie | Helix remove channel moderator (`channel:manage:moderators`) |
| `POST /api/twitch/vips/{userId}` | cookie | Helix add channel VIP (`channel:manage:vips`) |
| `DELETE /api/twitch/vips/{userId}` | cookie | Helix remove channel VIP (`channel:manage:vips`) |

Target channel is always derived from the auth cookie's claim, never accepted from the client.

`/api/twitch/*` calls Helix directly with the caller's own stored token, whereas `/api/channel/*` goes through YEPPBot's internal API — hence the separate namespaces. The `{userId}` path segment is the *target* of the action (who gets modded/VIP'd); the broadcaster is always the caller, so these can only ever change the caller's own channel. Twitch's own client-error statuses are passed through rather than flattened (404 unknown user, 409 already a VIP, 422 already a moderator or the broadcaster themselves), since that is where the actionable detail lives.

The moderator and VIP lists are read whole rather than page by page: the API follows Helix's cursor to the end (100 per page) and keeps the result in a process-wide cache, so the frontend never deals with cursors. Freshness is re-checked by request, not by clock — a repeat call always fetches page one, and if every entry on it is already cached the cached list is returned unchanged (one Helix request); anything unfamiliar triggers a full re-pagination. Our own add/remove calls drop the affected entry outright. The blind spot is a removal beyond the first page with no additions, which page one cannot reveal — it resolves on the next mutation or restart, which is an acceptable trade for a list that is nearly always ≤100 entries and changes almost exclusively through this dashboard.

### NuGet packages
`Microsoft.AspNetCore.Authentication.OpenIdConnect`, `Dapper`, `MySqlConnector`, `Microsoft.Extensions.Http` + `Microsoft.Extensions.Http.Resilience` (for `HttpBotClient`), `Microsoft.AspNetCore.OpenApi`, `Serilog.AspNetCore`, `Microsoft.Extensions.Diagnostics.HealthChecks`. Dev-only: `dotnet user-secrets` for Twitch client secret + internal API key.

---

## Frontend Design (Angular 22 + Material)

Standalone components, functional `CanActivateFn` guards, signals for state (no NgRx needed at this scope). `app.config.ts` wires `provideRouter`, `provideHttpClient(withFetch())`, `provideAnimationsAsync()`. `authGuard` on `/dash` checks a signal hydrated from `GET /api/auth/me`. Login is a plain `<a href="/api/auth/login">` (full navigation, not a router link or XHR) so the server-driven OAuth redirect chain works.

**Routing**: `/dash` is a lazily loaded feature module (`DashModule`) holding the sidebar layout, the dashboard landing card and `/dash/role-management`, which reads `?mode=moderator|vip` as a component input (`bindToComponentInputs`). Lazy is worth it here: the dashboard's Material table, sort, dialog, input, list, sidenav and progress bar are ~254 kB that the prerendered public pages never touch.

**Dashboard navigation**: the "Management" section lives in a `mat-sidenav` drawer (`mode="over"`), not a static column — it slides in over the content and minimizes itself again once an entry is picked or the backdrop is clicked. The toggle button sits in the navbar (visible only once signed in), which is outside the lazy `DashModule` entirely, so a small root-provided `SidebarService` (one boolean signal) is what connects the two without the navbar depending on the dashboard module.

**Role management**: one component in two configurations. It reads the full role list from `/api/twitch/moderators` or `/api/twitch/vips`, then resolves avatars for everyone on it through a single batched `/api/twitch/users` call, since the role endpoints only return ids and names. `UserTableComponent`'s `showId` input controls whether the id column renders at all, and it prefetches every row's chat colour as soon as it gets its users — the details dialog reads the same cache, so by the time someone opens it the colour is usually already there instead of loading visibly. Every add and remove ends in a snack bar in the bottom-right corner, failures in the error colours and on screen twice as long, because a failure usually carries the only explanation of what went wrong. Adding a role member has no UI yet — the login-based add flow lives on `RoleManagementComponent` (`submit`/`add`) unwired, waiting on a future dialog.

**Theming**: seed color `#9ACD32` (`rgb(154,205,50)`) via `ng generate @angular/material:m3-theme` (dark mode). M3's computed dark surface/background tones won't land exactly on the target `#0E0E10` (`rgb(14,14,16)`, Twitch's chrome) since they're derived from the seed hue — after generating the theme, explicitly override `--mat-sys-surface`/`--mat-sys-background`/related `surface-container*` tokens to `#0E0E10` in a clearly-marked brand-override block, so future Material upgrades don't silently regenerate over it.

**SSR**: reuse the same setup already proven in the `MCmoderSD.de` portfolio project (`C:\Users\MCmoderSD\WebstormProjects\Webpage`) — Angular 22 + `@angular/ssr` + Express runtime server (`src/server.ts`, `serve:ssr:*` npm script), same Angular/Material versions (`^22.0.x`), same 4-stage Dockerfile pattern (deps → build → prod-deps → runtime, non-root user, port 4000). Unlike the portfolio (which prerenders every route via `RenderMode.Prerender` on `**` in `app.routes.server.ts`), YEPPDash needs **hybrid per-route rendering**: `/` stays `RenderMode.Prerender` (build-time static HTML — SEO/link-preview metadata for Discord/Twitter shares of `dash.yeppbot.com`/`.dev`, zero runtime cost for that route), `/dash` is `RenderMode.Client` (personalized, behind the auth guard — cannot be prerendered at build time, rendered client-side like a normal SPA once the session cookie is confirmed via `/api/auth/me`).

Packages: `@angular/material`, `@angular/cdk`, `@angular/animations`, `@angular/ssr`, `@angular/platform-server`, `express`, `compression`, `angular-eslint`, `prettier`.

---

## Deployment

**Caddy lives outside this repo.** This repo ships source code and Dockerfiles only — no reverse-proxy config. Reverse proxying is handled by the operator's existing, separate Caddy setup (already running other sites), which will get new site blocks added for YEPPDash. This repo's `docker-compose.yml` is local-dev-only: it builds and runs the backend + frontend containers with their ports published directly (`8080`, `4000`), no proxy container in front.

**Domains & routing (subdomain-based, not path-based)**: both `yeppbot.com` and `yeppbot.dev` will be supported. Per domain:

| Subdomain | Routes to |
|---|---|
| `dash.yeppbot.com` / `dash.yeppbot.dev` | YEPPDash Frontend (`:4000`) |
| `api.yeppbot.com` / `api.yeppbot.dev` | YEPPDash Backend (`:8080`) |

This replaces the earlier path-based design (`yeppbot.com/` + `yeppbot.com/api/*`) from Phase 0. The switch to subdomains means frontend and backend are different origins to the browser — see [Auth](#auth) for the resulting CORS + cookie `Domain` requirements. The operator's Caddy setup gets automatic HTTPS per site block as usual; nothing here needs to change when that happens.

**Docker images**: both frontend and backend are multi-stage builds producing slim runtime images — never `dotnet run`/`ng serve` inside a container, those are dev-only. Backend: SDK image builds + publishes, `mcr.microsoft.com/dotnet/aspnet:10.0` runs `dotnet YEPPDash.Api.dll`. Frontend: reuse the exact 4-stage pattern from `MCmoderSD.de`'s `Dockerfile` (deps/build/prod-deps/runtime on `node:26-alpine`, non-root user, `CMD ["node", "dist/YEPPDash/server/server.mjs"]`, `EXPOSE 4000`) — proven, already in production use, no need to design a new pattern.

Backend and YEPPBot run on the same dedicated server in Docker for now, but should stay portable to split hosts later. Design for that from day one: the Bot API base URL is a config value (not hardcoded `localhost`), and the shared-secret header is always required (not "trust the private network" alone). Today, keep the internal API off the operator's public Caddy site blocks entirely (only reachable on the shared Docker network); if it's ever split across hosts, front the internal API with a private tunnel (WireGuard/Tailscale) or an IP-allowlisted TLS listener — an ops-time decision, no code changes needed since the client already carries a config URL + secret.

---

## Phased Roadmap

**Phase 0 — Scaffolding & smoke tests**: `git init`; `dotnet new webapi` for `YEPPDash.Api`; `ng new frontend --standalone --routing --style=scss`, add Material + generate M3 theme with brand override; add Dapper/MySqlConnector and a throwaway `GET /api/_internal/dbcheck` to validate DB connectivity and the `BIT(1)` mapping against the least-priv `yeppdash_ro` user (against Dev, `10.10.10.1`); local `docker-compose.yml` with backend + frontend only, ports published directly, no proxy container — no local DB container, the backend connects out to the real Dev/Prod MariaDB via `DbTarget` — confirm both containers serve correctly and the theme renders. Also generate the three diagrams above as real `.excalidraw` scene files (architecture, auth sequence, join sequence) for editing/sharing.

*(Amended after initial completion: Phase 0 originally verified this through a local Caddy container doing path-based routing. That Caddy setup has since been removed from this repo — reverse proxying now lives entirely in the operator's separate, existing Caddy setup, and production routing is subdomain-based, not path-based. See [Deployment](#deployment).)*

**Phase 1 — Twitch auth end-to-end**: reuse YEPPBot's existing Dev/Prod Twitch apps (add YEPPDash's callback redirect URIs alongside the bot's own); implement backend OIDC + `/api/auth/*`; implement frontend landing page, guard, `AuthService`, `/dash` shell. Exit: real login → `/dash`, session survives refresh, logout works.

**Phase 2 — Channel join/leave v1 (against `StubBotClient`)**: backend `/api/channel/*` + `IBotClient`/`StubBotClient`; frontend status card + join/leave button with loading/error states. Exit: full UI flow works end-to-end against the stub. Swapping in `HttpBotClient` once the separate YEPPBot-side API change ships is a config-only follow-up, not a code change here.

**Phase 3 — Command management**: placeholder only, scope later.

---

## Verification

- Phase 0: `GET /api/_internal/dbcheck` (`http://localhost:8080`) returns real rows from the Dev DB; Angular renders at `http://localhost:4000` with the correct green/dark theme in both light/dark OS settings.
- Phase 1: manual browser test — click "Login with Twitch" through to `/dash`, confirm `GET /api/auth/me` returns the right Twitch ID, confirm cookie is httpOnly/Secure in devtools, confirm logout clears the session.
- Phase 2: manual browser test against the stub — join/leave button toggles status card state, error state renders if the stub simulates a failure. Once the real YEPPBot internal API exists (separate task), re-test the same flow with `HttpBotClient` and confirm the bot actually joins live Twitch chat, not just the DB flag.