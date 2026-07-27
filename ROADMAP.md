# YEPPDash — Roadmap

Konkrete, abhakbare Schrittfolge zur Umsetzung von [PLAN.md](PLAN.md). Jeder Schritt wird gemeinsam durchgegangen, bevor der nächste beginnt.

## Phase 0 — Repository & Scaffolding

- [x] 1. Root-Skeleton: `git init` in `C:\Users\MCmoderSD\Desktop\YEPPDash`
- [x] 2. `.gitignore` anlegen (dotnet + Node/Angular + Docker kombiniert), `README.md` anlegen
- [x] 3. Erstes Commit (`PLAN.md`, `ROADMAP.md`, `.gitignore`, `README.md`)
- [x] 4. Backend-Projekt in Rider anlegen: Location `backend/`, Template "ASP.NET Core Empty", net10.0, `.slnx`, Git-Repo-Checkbox **deaktiviert**, "Put solution and project in same directory" **deaktiviert**, Top-Level-Statements **aktiv**, HTTPS **aktiv**, Launch Settings **inkludiert** — läuft, `dotnet build` grün
- [x] 5. Frontend-Projekt in WebStorm anlegen: Location `frontend/`, Angular 22, `--standalone --routing --style=scss --ssr`, Git-Init-Option **deaktiviert** — baut, SSR-Bundles + Prerendering laufen
- [x] 6. `ng add @angular/material`, M3-Theme generieren (Seed `#9ACD32`, dark mode), Brand-Override für `--mat-sys-surface`/`--mat-sys-background` auf `#18181B` — dabei zusätzlich `provideAnimationsAsync()` ergänzt (kam nicht automatisch)
- [x] 7. Commit: gescaffoldetes Backend + Frontend
- [x] 8. Backend: `Dapper` + `MySqlConnector` NuGet-Pakete hinzufügen — Dapper 2.1.79, MySqlConnector 2.6.1, `dotnet build` grün
- [x] 9. Least-privilege DB-User (SELECT-only auf `User`/`Channel`) auf dem `helix`-Schema anlegen (manueller Ops-Schritt, nicht im Code) — `yeppdash_ro`@`%` auf Prod, SELECT-only auf `helix.User`/`helix.Channel`; zusätzlich neue `YEPPDash`-DB auf Dev + Prod angelegt, Full-Access über YEPPBots bestehenden `helix`-User (dessen `helix.*`-Rechte sind sein eigentlicher Bot-Zugriff, nicht dashboard-spezifisch — später ggf. durch dedizierten Dashboard-User ersetzbar)
- [x] 10. Throwaway-Endpoint `GET /api/_internal/dbcheck` gegen den DB-User testen, insbesondere `BIT(1)`-Mapping von `Channel.active`/`autoShoutout` verifizieren — bestätigt: MySqlConnector liefert `BIT(1)` als `UInt64`, nicht `bool`; `BitBoolTypeHandler` registriert, Endpoint liefert danach saubere `bool`-Werte gegen `yeppdash_ro` auf Dev
- [x] 11. Lokale `docker-compose.yml`: Backend-Container, Frontend-SSR-Container, Caddy — kein lokaler DB-Container, Backend verbindet sich über `DbTarget` (`Dev`/`Prod`, Default `Dev`) nach draußen zu den echten Servern 10.10.10.1/dedi.mcmodersd.de; Zugangsdaten über gitignorete `.env` (Vorlage: `.env.example`)
- [x] 12. Caddyfile (`infra/Caddyfile`): `/` → Frontend-Container `:4000`, `/api/*` → Backend-Container, aktuell auf `:80` (noch kein Reverse-Proxy-VPS vorhanden)
- [x] 13. Vollständigen Round-Trip lokal verifizieren: Theme rendert korrekt, `dbcheck` liefert Daten — im Browser über `http://localhost/` bestätigt: `body`-Hintergrund `rgb(24,24,27)`/`--mat-sys-surface: #18181b`, `--mat-sys-primary: #a3d73c`, `color-scheme: dark`, keine Konsolenfehler; `/api/_internal/dbcheck` liefert echte Dev-DB-Zeilen durch Caddy
- [x] 14. Drei Diagramme aus PLAN.md als `.excalidraw`-Szenendateien exportieren (Architektur, Auth-Flow, Join-Flow) — liegen unter `docs/diagrams/`, strukturell validiert (Schema, Bound-Element-Referenzen, keine doppelten IDs); kurzer Sichtcheck in Excalidraw selbst empfohlen

## Phase 1 — Twitch Auth Ende-zu-Ende

- [ ] 1. Twitch-App registrieren (Redirect-URIs für lokal + Prod)
- [ ] 2. Backend: `Microsoft.AspNetCore.Authentication.OpenIdConnect` einrichten, Cookie-Scheme als Default, OIDC als Challenge-Scheme
- [ ] 3. `claims`-Parameter-Workaround für Twitch-E-Mail-Scope implementieren (`OnRedirectToIdentityProvider`)
- [ ] 4. `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`, `/api/auth/me` implementieren
- [ ] 5. Frontend: Landing-Page `/` mit "Login with Twitch"-Link (`<a href="/api/auth/login">`, kein Router-Link)
- [ ] 6. Frontend: `AuthService` (Signal-basiert), `authGuard` für `/dash`, `/dash`-Shell-Komponente
- [ ] 7. Manueller Test: Login → Twitch-Consent → `/dash`, Session übersteht Reload, Logout funktioniert

## Phase 2 — Channel Join/Leave v1 (gegen Stub)

- [ ] 1. Backend: `IBotClient`-Interface + `StubBotClient` (In-Memory-Fake)
- [ ] 2. Backend: `/api/channel/status|join|leave`, Ziel-Channel immer aus Auth-Claim abgeleitet
- [ ] 3. Frontend: `ChannelService`, Status-Karte + Join/Leave-Button mit Loading-/Error-States
- [ ] 4. Manueller Test: vollständiger UI-Flow gegen den Stub
- [ ] 5. *(separat, außerhalb dieses Repos)*: YEPPBot-seitige interne API nach dokumentiertem Contract umsetzen
- [ ] 6. Sobald verfügbar: `HttpBotClient` per Config aktivieren, End-to-End gegen echten Bot re-testen (live Chat-Join, nicht nur DB-Flag)

## Phase 3 — Command Management

- [ ] Scope wird später festgelegt, kein Umsetzungsschritt bisher.