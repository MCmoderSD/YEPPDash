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
- [x] 5. Frontend: Landing-Page `/` mit "Login with Twitch"-Link (`<a href>`, kein Router-Link) — Material-Card, leitet zusätzlich bei bestehender Session automatisch auf `/dash` weiter (client-seitig via `afterNextRender`, damit `/` weiterhin statisch prerendert bleibt)
- [x] 6. Frontend: `AuthService` (Signal-basiert: `currentUser`/`isAuthenticated`), `authGuard` für `/dash`, `/dash`-Shell mit Logout-Button
- [x] 7a. Manueller Test (Teil 1, ohne Frontend): Login → Twitch-Consent → `/api/auth/me` — bestätigt: `{"twitchId":"164284617","login":"MCmoderSD","email":"social@mcmodersd.de"}`
- [x] 7b. Vollständiger Test gegen `/dash` inkl. Logout — **bestätigt**. Dabei zwei echte Bugs gefunden und behoben:
  - **CORS + Open Redirect**: Frontend und Backend sind grundsätzlich verschiedene Origins (lokal andere Ports, in Prod `dash.`/`api.`-Subdomains), daher `AddCors` mit Origin-Allowlist (`AllowedFrontendOrigins`) nötig. Dieselbe Allowlist validiert jetzt auch den `returnUrl`-Parameter von `/api/auth/login`, der vorher jede beliebige URL akzeptierte. Zusätzlich liefert `/api/auth/me` ohne Session ein schlichtes 401 statt eines Twitch-Redirects (302), damit der `fetch`-Check im Frontend funktioniert.
  - **Cookie kam nie im Browser an**: Der Angular-Dev-Server lief auf `http`, das Backend auf `https` — unter *schemeful same-site* gelten die beiden dadurch als **cross-site**, wodurch der Browser das Auth-Cookie bei jedem `/api/auth/me` weggelassen hat (Login klappte, aber `/dash` warf sofort zurück auf `/`). Gelöst, indem der Dev-Server jetzt ebenfalls HTTPS spricht — mit demselben, bereits vertrauenswürdigen .NET-Dev-Zertifikat (`dotnet dev-certs --export`, `.certs/` ist gitignored). Damit entspricht die lokale Origin-Konstellation der späteren Prod-Situation.

**Debug-Logging** (Console, `ILogger`): frischer Twitch-Login (erfolgreich/fehlgeschlagen) vs. wiedererkanntes Cookie sind unterscheidbar; der Fehlerfall protokolliert Origin und die tatsächlich mitgeschickten Cookie-Namen — genau das hat den Cookie-Bug oben lokalisiert.

## Phase 1b — Von OIDC auf direktes OAuth2

Branch `feat/twitch-oauth2-direct`. Phase 1 lief über OIDC und funktionierte, brauchte aber drei Twitch-spezifische Workarounds und lieferte am Ende trotzdem nur Identität — kein Access Token für die Helix-Calls, die Phase 2 ohnehin braucht (Bot-Mod-Rechte setzen/entfernen, Ban/Block des Bots erkennen). Der Authorization-Code-Flow von Hand liefert beides in einem Durchgang.

- [x] 1. `Microsoft.AspNetCore.Authentication.OpenIdConnect` entfernt; Cookie-Scheme ist jetzt das einzige registrierte Scheme (kein Challenge-Scheme mehr → kein versehentlicher Twitch-Redirect bei unauthentifizierten Requests)
- [x] 2. `TwitchOAuthClient` (authorize-URL, `/oauth2/token` für Code-Tausch und Refresh, `/oauth2/revoke`) und `TwitchApiClient` (`/helix/users`) als typed `HttpClient`s
- [x] 3. Scope-Sets exakt wie YEPPBots zwei Twitch-Apps, ausgewählt über `DbTarget` (`TwitchScopes.For`): Prod 13 Scopes, Dev alle 80 die Twitch kennt — eine Zustimmung deckt Dashboard und Bot ab
- [x] 4. `state`-Handling selbst gebaut (`OAuthStateCookie`): 32-Byte-Nonce in Authorize-URL + kurzlebigem httpOnly-Cookie, Vergleich in konstanter Zeit, Cookie ist single-use. Die Return-URL läuft im Cookie statt über Twitch und wird zusätzlich gegen `AllowedFrontendOrigins` geprüft
- [x] 5. Token-Persistenz: `TwitchToken` in der eigenen `YEPPDash`-DB, Access + Refresh Token AES-256-GCM-verschlüsselt (Key = SHA-256 des Client Secrets). `ConnectionStrings:YeppDash{DbTarget}` ist Pflicht — fehlt sie, startet die App gar nicht erst
- [x] 6. `TwitchAuthService.GetValidTokenAsync` refresht 5 Minuten vor Ablauf und ersetzt die Zeile — Twitch gibt beim Refresh ggf. einen neuen Refresh Token zurück. Schlägt der Refresh fehl (Passwortwechsel, App getrennt, revoked), wird die Zeile verworfen statt endlos weiterzuprobieren
- [x] 7. `/api/auth/me` liest das Profil bei jedem Aufruf frisch aus `/helix/users` — nur die ID ist stabil, Login/Display-Name/Avatar/E-Mail ändern sich. Ist Twitch nicht erreichbar, antwortet der Endpoint aus den Cookie-Claims statt alle auszuloggen
- [x] 8. Fehlerpfade landen wieder auf dem Frontend (`/?error=...`) statt auf rohem JSON; die Landing-Page zeigt dafür eine Meldung
- [x] 9. `SameSite=None`-Sonderfall für Development entfernt — seit der Dev-Server HTTPS spricht, sind Frontend und Backend same-site, `Lax` reicht in allen Umgebungen
- [x] 10. Verifiziert ohne Twitch-Consent (den kann nur der Betreiber klicken): `/health` 200, `/api/auth/me` ohne Cookie 401, Authorize-URL mit korrekten 13 Scopes + passendem State-Cookie, fremde `returnUrl` wird verworfen, falscher State → `invalid_state`, Consent-Abbruch → `access_denied`, echter Code-Tausch erreicht Twitch (Antwort `Invalid authorization code` für einen Fake-Code beweist, dass Client-ID, Secret und Redirect-URI stimmen). AES-GCM-Cipher separat auf Round-Trip, Nicht-Determinismus und Tamper-Erkennung geprüft
- [x] 11. Echter Login mit Twitch-Consent durchgeklickt — **bestätigt**, kompletter Durchlauf am Stück: Code-Tausch (200) → `/helix/users` (200) → `Login succeeded via Twitch for 164284617 (mcmodersd), 80 scopes granted` (Dev-App, also das volle Scope-Set) → `/api/auth/me` liest das Profil erneut live aus Helix → Logout revoked den Token bei Twitch (200) und löscht die Zeile → der nächste `/me` sieht `cookies=[]` und antwortet 401
- [x] 12. `ConnectionStrings:YeppDashDev`/`YeppDashProd` in `appsettings.Local.json` eingetragen (Datei ist gitignored), zeigen auf die `YEPPDash`-DB auf 10.10.10.1 bzw. dedi.mcmodersd.de
- [x] 13. DB-Rechte für `yeppdash_ro` auf der `YEPPDash`-DB ergänzt (Ops-Schritt beim Betreiber; vorher `Access denied for user 'yeppdash_ro'@'%' to database 'YEPPDash'`). `TwitchToken` wird seitdem beim Start selbst angelegt — Schema gegen Dev verifiziert (`userId INT PRI`, `accessToken`/`refreshToken`/`scopes` TEXT, `expiresAt`/`updatedAt` DATETIME). Der Lese-Rechtename ist inzwischen irreführend: derselbe User ist auf `helix` weiterhin SELECT-only, auf `YEPPDash` aber schreibberechtigt — ein eigener Dashboard-User wäre sauberer
- [ ] 14. **Offen (Ops, Prod)**: dieselben Grants auf dem Prod-Server (`dedi.mcmodersd.de`) setzen; bisher nur gegen Dev verifiziert

Phase 1b ist damit funktional abgeschlossen — Login, Session, Live-Profil, Token-Persistenz, Refresh-Pfad und Logout inkl. Revoke laufen Ende zu Ende.

**Bewusst nicht gemacht**: in YEPPBots `helix.RefreshToken` schreiben. Das würde den Bot direkt mit-autorisieren, aber beide Prozesse teilten sich dann einen Refresh Token pro User — und da Twitch den Refresh Token bei Benutzung rotiert, fliegt der jeweils zweite raus. Details in [PLAN.md](PLAN.md#auth).

## Phase 2 — Bot-Steuerung (Join/Leave)

Die in PLAN.md ursprünglich geplante `IBotClient`/`StubBotClient`/`HttpBotClient`-Abstraktion wurde beim Umsetzen verworfen — YEPPBot bekam stattdessen direkt eine eigene kleine HTTP-API, gegen die YEPPDash ohne Zwischenschritt spricht. Details in [`docs/yeppbot-api-client.md`](docs/yeppbot-api-client.md).

- [x] 1. ~~`IBotClient`-Interface + `StubBotClient`~~ **anders gelöst**: `YeppBotClient` ist eine einzelne konkrete Klasse, die per HTTP `POST` gegen eine laufende YEPPBot-Instanz spricht (`JoinChannel/{id}`, `LeaveChannel/{id}`, später auch `UpdateCustomCommands/{id}`, siehe Phase 6), authentifiziert mit einem aus dem Twitch-Client-Secret abgeleiteten Bearer-Token. Ist keine Bot-Basis-URL konfiguriert, wird `YeppBotClient.Configured` `false` und Aufrufe werden zu No-Ops (`NotConfigured`) — das übernimmt die Rolle des ursprünglich geplanten Stub, ohne eine eigene Implementierung zu brauchen
- [x] 2. Backend: `BotController` (`POST bot/{userId}/join`, `POST bot/{userId}/leave`), Zielkanal immer aus dem Auth-Claim abgeleitet
- [x] 3. Frontend: `BotManageComponent` auf der Dashboard-Startseite (`/dash`) — zeigt Bot-Status (gebannt/geblockt/Moderator/im Chat) und Join-/Leave-Buttons

## Phase 3 — Twitch-Rollen & Community-Daten

- [x] 1. Backend: `TwitchController` (Route `twitch`) + `TwitchChannelService` — Moderatoren, VIPs, Editoren (nur lesend, Helix bietet dort kein Add/Remove), Follower, Bans/Unbans, Blocks/Unblocks, Chatter; alles seitenweise gegen Helix paginiert
- [x] 2. `TwitchChannelCache` (In-Process, pro Rolle + Broadcaster) + `TwitchChannelWarmup`/`-WarmupWorker` — wärmt die Caches beim Start und bei jedem Login für alle Kanäle mit gespeichertem Token vor
- [x] 3. Frontend: `RoleManagementComponent` in zwei Konfigurationen (`?mode=0|1` = Moderator/VIP) über die Sidebar erreichbar; `UserAddDialogComponent` löst einen eingegebenen Namen erst gegen einen echten Account auf, bevor etwas hinzugefügt wird
- [x] 4. Rollen-Badges, Chat-Farbe und Verified-Status auf jeder User-Anzeige

## Phase 4 — Quote-Verwaltung

- [x] 1. Backend: `QuoteController`/`QuoteService`/`QuoteRepository` — CRUD, Umsortieren (transaktionale ID-Verschiebung), Excel-Export/-Import (ClosedXML, 5 MB Limit) gegen YEPPBots `Quote`-Tabelle
- [x] 2. Frontend: `QuoteManagementComponent` (`/dash/quotes`) — sortier-/filterbare Tabelle, Drag-Reorder, Excel-Import/-Export, `ConfirmActionDialogComponent` vor destruktiven Aktionen

## Phase 5 — Follower-Geburtstage

- [x] 1. Backend: `BirthdayController`/`BirthdayService`/`BirthdayRepository` — eigenen Geburtstag lesen/setzen/ändern, Follower-Geburtstage per Schnittmenge aus gespeicherten Einträgen und aktuellen Followern
- [x] 2. Frontend: `BirthdayListComponent` (`/dash/birthdays`) — Alter/Countdown, lokalisierte Datumsanzeige (`LocaleDatePipe`)

## Phase 6 — Custom Commands

- [x] 1. Backend: `CustomCommandController`/`CustomCommandService`/`CustomCommandRepository` — Trigger-/Alias-Validierung, Eindeutigkeit pro Kanal; jede schreibende Aktion löst über `YeppBotClient.UpdateCustomCommandsAsync` einen Hot-Reload des laufenden Bots aus
- [x] 2. Frontend: `CommandPageComponent` (`/dash/commands`) — Anlegen/Bearbeiten/Löschen/Aktivieren

## Phase 7 — BDSM-Testergebnisse

- [x] 1. Backend: `BdsmController`/`BdsmService`/`BdsmRepository` — eigene Ergebnisse sowie die der eigenen Follower (gleiches Schnittmenge-Muster wie Phase 5)
- [x] 2. Frontend: `BdsmPageComponent` (`/dash/bdsm`) — zwei Tabs (eigene Ergebnisse / Community), mehrere Ergebnisse gleichzeitig aufklappbar

## Phase 8 — Community-Übersicht

- [x] 1. Frontend: `CommunityPageComponent` (`/dash/community`) — sortier-, filter- und paginierbare Tabelle aller Follower

## Phase 9 — Landing Page & rechtliche Seiten

- [x] 1. Frontend: Feature-Liste der Landing-Page an den echten Funktionsumfang angepasst (Rollen-Verwaltung, Custom Commands, Geburtstage — mit Status-Badges "Stable"/"Works, buggy"/"Coming soon"), Beta-Disclaimer-Abschnitt ergänzt
- [x] 2. Footer verlinkt Imprint/Privacy/Terms sowie beide GitHub-Repos (YEPPBot, YEPPDash), gruppiert neben dem Copyright-Hinweis statt bei den rechtlichen Links

## Offen

- [ ] Auto-Shoutouts für Raids (auf der Landing-Page bereits als "Coming soon" angekündigt) — kein Code dafür vorhanden
- [ ] Dedizierter Moderations-Bereich im Dashboard: Unban-/Unblock-Endpoints (`twitch/banned/*`, `twitch/blocked/*`) existieren bereits im Backend, werden aber bisher nur von `BotManageComponent` genutzt, nicht von einer eigenen Seite
- [ ] Prod-DB-Grants für `yeppdash_ro` auf `dedi.mcmodersd.de` — siehe Phase 1b, Schritt 14, weiterhin offen