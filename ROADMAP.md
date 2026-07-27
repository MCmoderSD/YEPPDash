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
- [x] 11. Lokale `docker-compose.yml`: Backend-Container, Frontend-SSR-Container — kein lokaler DB-Container, Backend verbindet sich über `DbTarget` (`Dev`/`Prod`, Default `Dev`) nach draußen zu den echten Servern 10.10.10.1/dedi.mcmodersd.de; Zugangsdaten über gitignorete `.env` (Vorlage: `.env.example`); Ports `8080`/`4000` direkt published (**amendiert**, siehe unten)
- [x] 12. ~~Caddyfile (`infra/Caddyfile`)~~ **zurückgebaut**: Caddy läuft nicht in diesem Repo, sondern im bereits bestehenden, separaten Caddy-Setup des Betreibers. Dort werden künftig eigene Site-Blöcke für `dash.yeppbot.com`/`.dev` (→ Frontend) und `api.yeppbot.com`/`.dev` (→ Backend) ergänzt — Subdomain-Routing statt der ursprünglich geplanten Pfad-Variante (`yeppbot.com/` + `/api/*`). Details in [PLAN.md](PLAN.md#deployment).
- [x] 13. Vollständigen Round-Trip lokal verifiziert (Original-Durchführung, vor der Caddy-Entfernung): Theme rendert korrekt, `dbcheck` liefert Daten — im Browser über `http://localhost/` bestätigt: `body`-Hintergrund `rgb(24,24,27)`/`--mat-sys-surface: #18181b`, `--mat-sys-primary: #a3d73c`, `color-scheme: dark`, keine Konsolenfehler; `/api/_internal/dbcheck` liefert echte Dev-DB-Zeilen. Nach Schritt 12 (Amendment) läuft der lokale Zugriff direkt über `http://localhost:4000` (Frontend) / `http://localhost:8080` (Backend), ohne Proxy davor — funktional unverändert, nur ohne den zwischenzeitlichen Caddy-Hop.
- [x] 14. Drei Diagramme aus PLAN.md als `.excalidraw`-Szenendateien exportieren (Architektur, Auth-Flow, Join-Flow) — liegen unter `docs/diagrams/`, strukturell validiert (Schema, Bound-Element-Referenzen, keine doppelten IDs); kurzer Sichtcheck in Excalidraw selbst empfohlen

## Phase 1 — Twitch Auth Ende-zu-Ende

- [x] 1. ~~Twitch-App registrieren~~ **entfällt**: YEPPBot besitzt bereits eigene Twitch-Apps für Dev und Prod, diese werden 1:1 mitgenutzt (`Twitch:ClientIdDev`/`ClientSecretDev`, `Twitch:ClientIdProd`/`ClientSecretProd` — als `dotnet user-secrets` hinterlegt, nie committed). Offen (Ops-Schritt beim Nutzer, nicht in diesem Repo): in der Twitch Developer Console zusätzlich zur bestehenden Redirect-URI (`https://home.mcmodersd.de:420/callback`, bleibt für den Bot selbst bestehen) die YEPPDash-Callback-URIs eintragen — lokal `https://localhost:7218/api/auth/callback` (Kestrels eigener HTTPS-Port aus `launchSettings.json`, Backend läuft dafür direkt per `dotnet run`/Rider — kein Docker, kein Caddy; Port 8080 war auf dem Dev-Rechner bereits belegt), später `https://api.yeppbot.com/api/auth/callback` (Prod) und `https://api.yeppbot.dev/api/auth/callback` (Dev). Details in [PLAN.md](PLAN.md#auth).
- [x] 2. Backend: `Microsoft.AspNetCore.Authentication.OpenIdConnect` (NuGet-Paket ergänzt, nicht Teil des Shared Framework) eingerichtet, Cookie-Scheme als Default, OIDC als Challenge-Scheme, `ClientId`/`ClientSecret` je nach `DbTarget` (Dev/Prod) aus den zugehörigen Twitch-App-Credentials
- [x] 3. `claims`-Parameter-Workaround für Twitch-E-Mail-Scope implementiert (`OnRedirectToIdentityProvider`) — zusätzlich zum `email`-Scope-Trick brauchte auch `login` (`preferred_username`) denselben Workaround, sonst kommt es `null` zurück; beide jetzt im `claims`-Parameter: `{"id_token":{"email":null,"preferred_username":null}}`
- [x] 4. `/api/auth/login` (Challenge, optionaler `returnUrl`, Default `/api/auth/me` solange es noch kein `/dash` gibt), `/api/auth/callback` (via OIDC-Middleware `CallbackPath`, kein eigener Endpoint nötig), `/api/auth/logout`, `/api/auth/me` implementiert
- [ ] 5. Frontend: Landing-Page `/` mit "Login with Twitch"-Link (`<a href="/api/auth/login">`, kein Router-Link)
- [ ] 6. Frontend: `AuthService` (Signal-basiert), `authGuard` für `/dash`, `/dash`-Shell-Komponente
- [x] 7a. Manueller Test (Teil 1, ohne Frontend): Login → Twitch-Consent → `/api/auth/me` (Platzhalter-Ziel, da `/dash` noch nicht existiert) — **echt durchgeführt und bestätigt**: `{"twitchId":"164284617","login":"...", "email":"social@mcmodersd.de"}` (E-Mail beim ersten Durchlauf korrekt, `login` war zunächst `null`, siehe Schritt 3 — Fix noch nicht erneut gegengetestet, da dafür ein frischer Login nötig ist, das bestehende Cookie trägt noch die alten Claims)
- [ ] 7b. Session übersteht Reload, Logout funktioniert, sowie vollständiger Test gegen `/dash` — verschoben bis Schritt 5/6 (Frontend) stehen

## Phase 2 — Channel Join/Leave v1 (gegen Stub)

- [ ] 1. Backend: `IBotClient`-Interface + `StubBotClient` (In-Memory-Fake)
- [ ] 2. Backend: `/api/channel/status|join|leave`, Ziel-Channel immer aus Auth-Claim abgeleitet
- [ ] 3. Frontend: `ChannelService`, Status-Karte + Join/Leave-Button mit Loading-/Error-States
- [ ] 4. Manueller Test: vollständiger UI-Flow gegen den Stub
- [ ] 5. *(separat, außerhalb dieses Repos)*: YEPPBot-seitige interne API nach dokumentiertem Contract umsetzen
- [ ] 6. Sobald verfügbar: `HttpBotClient` per Config aktivieren, End-to-End gegen echten Bot re-testen (live Chat-Join, nicht nur DB-Flag)

## Phase 3 — Command Management

- [ ] Scope wird später festgelegt, kein Umsetzungsschritt bisher.