# Twitch API Client Reference

Endpoints and features of the two Twitch API wrappers in `backend/YEPPDash.Api/Twitch/`:

- [`TwitchApiClient`](#twitchapiclient-helix) — Helix (`api.twitch.tv`), used for everything the dashboard reads or changes about a channel
- [`TwitchOAuthClient`](#twitchoauthclient-id-twitch-tv) — the OAuth2 flow itself (`id.twitch.tv`)

Nothing in the browser talks to Helix directly. The chain is:

```
frontend TwitchService  →  backend /twitch/*  →  TwitchChannelService  →  TwitchApiClient  →  Helix
```

See [Dashboard surface](#dashboard-surface) for the two outer layers.

## `TwitchApiClient` (Helix)

All requests go through a private `SendAsync` that sets the `Bearer` token and `Client-Id` headers, and
turns any non-success response into a `TwitchOAuthException` carrying the status code and response body.

### Users

| Method | HTTP | Endpoint | Returns | Notes |
|---|---|---|---|---|
| `GetCurrentUserAsync` | GET | `users` | `TwitchUser` | Throws `TwitchOAuthException(404)` if Helix returns no user for the token |
| `GetUsersAsync` | GET | `users?id=…&login=…` | `IReadOnlyList<TwitchUser>` | Batch lookup, 1–100 ids/logins combined (`MaxBatchSize`); throws `ArgumentException` outside that range |
| `GetChatColorsAsync` | GET | `chat/color?user_id=…` | `IReadOnlyList<TwitchChatColor>` | Batch lookup, 1–100 user ids. Grouped here rather than under Chat: a chat colour is a property of the user, not of the channel's chat room |

### Moderators

| Method | HTTP | Endpoint | Returns | Notes |
|---|---|---|---|---|
| `GetModeratorsAsync` | GET | `moderation/moderators` | `HelixPage<TwitchChannelUser>` | Cursor-paginated |
| `GetModeratorsByIdAsync` | GET | `moderation/moderators?user_id=…` | `IReadOnlyList<TwitchChannelUser>` | Membership check for 1–100 users at once; answers with only those that really are moderators. Unpaged — 100 ids cannot outgrow one 100-row page |
| `AddModeratorAsync` | POST | `moderation/moderators` | – | |
| `RemoveModeratorAsync` | DELETE | `moderation/moderators` | – | |

### VIPs

| Method | HTTP | Endpoint | Returns | Notes |
|---|---|---|---|---|
| `GetVipsAsync` | GET | `channels/vips` | `HelixPage<TwitchChannelUser>` | Cursor-paginated |
| `GetVipsByIdAsync` | GET | `channels/vips?user_id=…` | `IReadOnlyList<TwitchChannelUser>` | Membership check for 1–100 users at once; answers with only those that really are VIPs. Shares `GetFilteredChannelUsersAsync` with the moderator check |
| `AddVipAsync` | POST | `channels/vips` | – | |
| `RemoveVipAsync` | DELETE | `channels/vips` | – | |

### Editors

| Method | HTTP | Endpoint | Returns | Notes |
|---|---|---|---|---|
| `GetEditorsAsync` | GET | `channels/editors` | `IReadOnlyList<TwitchChannelEditor>` | The one channel list Helix does not paginate. Carries no login, only id + display name + `created_at`, hence its own record |

Helix has no filtered form of this endpoint, so there is no `GetEditorsByIdAsync` on the client —
`TwitchChannelService` fetches the full list and matches against it instead. See the
[dashboard surface](#dashboard-surface) table for the `editors/check` route built on top.

### Followers

| Method | HTTP | Endpoint | Returns | Notes |
|---|---|---|---|---|
| `GetFollowersAsync` | GET | `channels/followers` | `HelixPage<TwitchFollower>` | Cursor-paginated in groups of 100; walked to the end and cached by `TwitchChannelService` like the moderator and VIP lists |
| `GetFollowerAsync` | GET | `channels/followers?user_id=…` | `TwitchFollower?` | Single-user check. `user_id` takes one value only, unlike Get Moderators. Helix also empties the page when the token lacks `moderator:read:followers`, so a null trusts the scope was granted |

### Bans

| Method | HTTP | Endpoint | Returns | Notes |
|---|---|---|---|---|
| `GetBannedUserAsync` | GET | `moderation/banned?user_id=…` | `TwitchBannedUser?` | Uses the filter as a single-user lookup instead of paging the whole ban list |
| `UnbanUserAsync` | DELETE | `moderation/bans` | – | Also needs `moderator_id` — the broadcaster acting as their own moderator |

### Blocks

| Method | HTTP | Endpoint | Returns | Notes |
|---|---|---|---|---|
| `GetBlockedUsersAsync` | GET | `users/blocks` | `HelixPage<TwitchChannelUser>` | Cursor-paginated; maps `TwitchBlockedUser` → `TwitchChannelUser` |
| `UnblockUserAsync` | DELETE | `users/blocks?target_user_id=…` | – | No `broadcaster_id` — blocks live on the account, not the channel |

### Chat

| Method | HTTP | Endpoint | Returns | Notes |
|---|---|---|---|---|
| `GetChattersAsync` | GET | `chat/chatters` | `HelixPage<TwitchChannelUser>` | Cursor-paginated; sets `moderator_id` = `broadcaster_id`, since the dashboard only ever reads its own channel |

## `TwitchOAuthClient` (id.twitch.tv)

| Method | Purpose |
|---|---|
| `BuildAuthorizationUrl` | Builds the `oauth2/authorize` URL with scopes and state |
| `ExchangeCodeAsync` | Exchanges the auth code for an access/refresh token |
| `RefreshAsync` | Renews the access token via the refresh token |
| `RevokeAsync` | Revokes a token; swallows failures — the local session ends either way |

## Dashboard surface

The backend routes under `/twitch` (`TwitchController`) and the frontend's `TwitchService`. Every
route is `[Authorize]`d and acts on the signed-in user's own channel — the broadcaster id is taken
from the session, never from the request.

The frontend asks for what it wants in one request and gets one answer. Helix's limits — 100 ids per
lookup, 100 rows per page — are the backend's problem: it splits and walks, the browser does not.

| Backend route | Frontend method | Returns | Notes |
|---|---|---|---|
| `GET twitch/chat-color/{userId?}` | `loadChatColor()` | `ChatColor` | The signed-in user's own colour, shown in the navbar. Everything else reads `color` off the user objects below |
| `GET twitch/users?id=&login=` | `getUsers(userIds, logins)` | `TwitchUser[]` | Any number of ids and logins; the service splits them into batches of 100 and merges the answers. Each user arrives complete — chat colour and channel roles (`roles`) already on it |
| `GET twitch/moderators` | `getModerators()` | `Moderator[]` | Full user profiles — avatar, colour, roles and all — assembled server-side: one Get Users and one Get User Chat Color batch per 100 entries, and the role flags settled against the cached moderator/VIP lists plus one editors call |
| `GET twitch/moderators/check?id=` | `getModeratorsById(ids)` / `isModerator(id)` | `ChannelUser[]` / `boolean` | Membership check for any number of users; batched server-side. Uncached — it asks about specific users rather than completing a list |
| `POST twitch/moderators/{userId}` | `addModerator(id)` | – | Invalidates the cached moderator list |
| `DELETE twitch/moderators/{userId}` | `removeModerator(id)` | – | Invalidates the cached moderator list |
| `GET twitch/vips` | `getVips()` | `Vip[]` | Full user profiles, assembled like the moderators |
| `GET twitch/vips/check?id=` | `getVipsById(ids)` / `isVip(id)` | `ChannelUser[]` / `boolean` | Membership check for any number of users; batched server-side. Uncached, same reasoning as the moderator check |
| `POST twitch/vips/{userId}` | `addVip(id)` | – | Invalidates the cached VIP list |
| `DELETE twitch/vips/{userId}` | `removeVip(id)` | – | Invalidates the cached VIP list |
| `GET twitch/editors` | `getEditors()` | `Editor[]` | Full user profiles plus `editorSince`. Unpaginated by Helix |
| `GET twitch/editors/check?id=` | `getEditorsById(ids)` / `isEditor(id)` | `ChannelEditor[]` / `boolean` | Twitch has no filtered form, so the service matches against the full list. The one check with no batch limit — the ids never reach Twitch. Uncached, so an editor added on Twitch's site shows up right away |
| `GET twitch/followers` | `getFollowers()` | `FollowerProfile[]` | Full user profiles plus `followedAt`, feeding the community page. Paged and cached server-side like the moderators; nothing here can add a follower, so the first-page check is the only thing that refreshes it. Enrichment costs two Helix batches per 100 followers, so a very large channel wants paging before this |
| `GET twitch/followers/{userId}` | `getFollowStatus(id)` / `isFollower(id)` | `FollowStatus` / `boolean` | 200 with a false flag rather than a 404, so "does not follow" is not a failed request |
| `GET twitch/chatters` | `getChatters()` | `ChannelUser[]` | Deliberately uncached — who is in chat turns over constantly |
| `GET twitch/blocked` | `getBlocked()` | `ChannelUser[]` | |
| `DELETE twitch/blocked/{userId}` | `unblockUser(id)` | – | Invalidates the cached blocked list |
| `GET twitch/banned/{userId}` | `getBanStatus(id)` / `isBanned(id)` | `BanStatus` / `boolean` | 200 with a false flag rather than a 404 |
| `DELETE twitch/banned/{userId}` | `unbanUser(id)` | – | |

A Twitch failure becomes a `502` when Twitch is unreachable, or the upstream status when Twitch
refused a `4xx` — see `HandleTwitchFailure`.

### How the cached lists stay current

Moderators, VIPs, blocked users and followers all go through the same walk in
`TwitchChannelService.GetChannelListAsync`, and are held per role and channel in
`TwitchChannelCache`:

1. Fetch the first page. If there is no cursor the list is short enough to be complete — store and
   return it.
2. Otherwise compare that page against the cached list. If it holds nothing new, the rest is assumed
   unchanged and the cache is served. This is what keeps a warm read at one request.
3. Otherwise walk every page and replace the cache.

Two consequences worth knowing:

- Step 2 rests on Helix putting new entries on the **first** page. An entry appearing further in
  would be missed until the cache is dropped another way.
- Writes through this API (`addModerator`, `removeVip`, `unblockUser`) invalidate the affected role
  explicitly. **Followers have no such write** — nobody can be made to follow from here — so step 2
  is the only thing that refreshes them, and a cold first read of a large channel walks every page.
