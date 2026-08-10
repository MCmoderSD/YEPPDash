# Frontend Testing Scope

Which parts of `frontend/src/` are worth a unit test, which are deliberately left without one, and why.

The previous suite was removed wholesale in `remove-unit-tests`. This document is what replaces it: a
short list of things worth testing, and — more importantly — a written record of what is *not* worth
testing, so the suite does not quietly grow back to what it was.

## What went wrong the first time

49 spec files, 10,084 lines of test code against 5,821 lines of source. A test-to-source ratio of
**1.73:1** on a dashboard this size is not thoroughness, it is drag: every component rename, every
Material upgrade, every signal refactor had to be paid for twice.

Worse, the coverage was aimed at the wrong layer:

| Layer | Test lines removed | Share | Logic density |
|---|---|---|---|
| `components/` + `pages/` | 7,934 | 79% | low — mostly wiring a service call to a notification |
| `services/` | 1,371 | 14% | low — thin HTTP wrappers over `ApiService` |
| `data/` | 670 | 7% | **high — the actual algorithms** |

The four largest specs were `wheel-page` (864 lines), `command-edit` (624), `quote-management` (547)
and `command-table` (434) — all orchestration components, all requiring four or five mocked services
to assert that a success message reads the way it reads. Those tests broke constantly and caught
nothing, because the thing they exercised was the mock, not the logic.

## The rule

> A test earns its place when it guards logic that **can be wrong in a way the compiler cannot catch
> and a glance at the running page would not reveal.**

Three questions, in order. A "no" at any point means no test:

1. **Is there a decision in here?** Arithmetic, parsing, sorting, branching, a boundary. Assigning an
   input to a field is not a decision. Calling `this.post(url)` is not a decision.
2. **Would it fail silently?** A broken layout is visible in a second. An off-by-one in
   `daysUntilNextBirthday` is visible in a year.
3. **Can it be tested without a TestBed?** If yes, it is nearly free. If no, the bar rises sharply —
   and the better answer is usually to extract the decision into a function that can be.

The codebase is already built for this. `wheel.component.ts` and `scroll-bar.component.ts` both hoist
their geometry into exported functions above the `@Component`, and the comment on `nearEdge` says so
outright: *split out from the component so the arithmetic can be reasoned about — and tested —
without a layout to measure*. That line is the whole policy. Test the functions, not the wiring.

## Tier 1 — pure functions, no TestBed

Cheap to write, fast to run, stable across Angular upgrades. These go in first.

| File | Cover | Why | Status |
|---|---|---|---|
| `data/wheel-entry.ts` | `addEntry`, `removeOne`, `wheelSlices`, `parseWheelFile`, `cleanLabel`, `entriesFrom` | The densest logic in the app. Case-insensitive merge, decrement-vs-delete, round-robin slice interleaving, and a parser with two rejection rules (separator, `WHEEL_MAX_SLICES`) | todo |
| `data/birthday.ts` | `ageOn`, `daysUntilNextBirthday` | Date boundaries: birthday today, birthday tomorrow, 29 February, year rollover. Textbook off-by-one territory, and wrong by a day is invisible until it is | todo |
| `data/wheel-result.ts` | `parseWheelResults` | Defensive parsing of untrusted `localStorage`. It exists purely to survive garbage — malformed JSON, a non-array, entries with a bad `wonAt`. Untested, that guarantee is only a comment | todo |
| `data/twitch-image.ts` | `twitchImageLoader` | Already earned it once: the size list was missing `96` and `600`, so every 96px avatar fetched a 150px file. Pins a fixed external CDN contract | todo |
| `components/wheel-component/` | `sliceAtPointer`, `restRotation`, `wheelSectors`, `fitLabel`, `paletteIndex`, `wheelFontSize` | Modular arithmetic on angles. `sliceAtPointer` normalises a negative rotation into `[0, 360)` — easy to get wrong, and wrong means the wheel announces the wrong winner | todo |
| `components/scroll-bar-component/` | `scrollBarAxis`, `scrollForThumbOffset`, `nearEdge` | Clamping and thresholds: the `overflow <= 1` sub-pixel guard, `MIN_THUMB_SIZE` losing to a shorter track, drag offset mapped back to scroll position | todo |
| `components/birthday-edit-dialog-component/locale-date.adapter.ts` | `parse` | Fixed a real, specific bug — a field that displayed `15.8.2004` and then refused to accept it. Also rejects rollover dates like `31.02`. A regression here is a form that silently will not submit | todo |
| `data/custom-command.ts` | `cleanTrigger`, `isValidTrigger` | `TRIGGER_PATTERN` is `/^[\p{L}\p{N}]+$/u` — the unicode classes matter and are easy to break by "simplifying" to `\w` | todo |

## Tier 2 — worth it, but not free

Real logic behind a small amount of setup. Add after Tier 1, and only as written here — not as
whole-component specs.

| File | Cover | Why | Status |
|---|---|---|---|
| `services/notification.service.ts` | `MAX_VISIBLE` eviction, timer cleanup | The one service with state worth defending: dropping past five must also clear the dropped timers, or `dismiss` fires against an id that is gone. Needs fake timers, nothing else | todo |
| `services/wheel-results.service.ts` | per-channel key, absent/throwing storage | Storage may be missing entirely (prerender, storage disabled) or throw on quota. Both are meant to degrade to an empty history rather than crash. A fake `Storage` covers it | todo |
| `data/bdsm-result.ts` | `topTraits` | Sorts by score with an index tie-break, so equal scores keep catalogue order. That stability is the only reason the list does not reshuffle between renders | todo |
| `data/dash-nav.ts` | `groupForUrl` | Single source for both the sidebar and the dashboard landing cards. Strips the query string on purpose, so the two role-management entries resolve to one group | todo |
| `data/wheel-overlay.ts` | `isWheelOverlayUrl` | Trailing slashes and query strings stripped before comparison. It gates a route that OBS loads — a miss shows the full dashboard inside a stream overlay | todo |
| `pipes/locale-date.pipe.ts` | null/undefined/invalid input | Returns `''` rather than `Invalid Date` for four separate input shapes. Small, but it is the fallback the whole UI leans on | todo |
| `services/page-meta.strategy.ts` | route description, fallback, deepest-route | Restore the spec deleted with the rest. Needs `RouterTestingHarness`, so it is the most expensive item here — justified because a broken meta description is invisible on screen and only shows up in search results | todo |

## Extract first, then test

Two pieces of genuine logic are currently trapped inside things that are expensive to test. Moving
them is cheaper than mocking around them, and turns both into Tier 1 entries.

| Where it is now | Move to | What | Status |
|---|---|---|---|
| `services/quote.service.ts` → `filenameOf` | `data/quote.ts` | An RFC 5987 `Content-Disposition` parser (`filename*=UTF-8''…` with a plain `filename="…"` fallback). Real parsing sitting in an otherwise thin HTTP wrapper | todo |
| `components/command-edit-component/` → `addAlias` dedup | `data/custom-command.ts` | A three-way filter: an alias must not repeat the command name, must not already be in the list, and must not repeat itself within one pasted entry. Genuinely tricky, and today only reachable through a rendered Material chip input | todo |

## Deliberately not tested

This section is the point of the document. Each of these had a spec before; none of them get one back.

| Not tested | Reason |
|---|---|
| `command.service`, `bot.service`, `birthday.service`, `bdsm.service`, `wheel.service`, `twitch.service`, most of `quote.service` | Thin wrappers over `ApiService`. A test asserts that the URL you typed is the URL you typed — it restates the implementation instead of checking it. The backend contract is what actually needs guarding, and a unit test with `HttpTestingController` cannot see it |
| `api.service.ts` | Five one-line verb helpers plus URL joining. Testing it tests `HttpClient` |
| `quote-management`, `command-page`, `command-table`, `community-page`, `role-management`, `birthday-list`, `bot-manage`, `bdsm-page`, `wheel-page` | Orchestration: call a service, show a notification, reload. Four or five mocks to assert a string. These were the four largest specs in the old suite and the most frequently broken |
| `badge`, `faq-entry`, `footer`, `user-badges`, `bdsm-result`, `navbar`, `sidebar`, `user-table`, `user-menu` | Presentational. Correctness here is *visual* — a test that the template renders an `@if` is a worse check than looking at it |
| `confirm-action-dialog`, `user-info-dialog`, `user-add-dialog`, `quote-edit-dialog`, `birthday-edit-dialog`, `wheel-winner-dialog` | Pass data in, hand a result back. The logic worth testing inside the birthday dialog is the date adapter, which is covered on its own in Tier 1 |
| `landing-page`, `imprint-page`, `privacy-page`, `terms-page`, `faq-page` | Static content |
| `services/sidebar.service.ts` | Three methods over one boolean signal. Testing `toggle()` flips a boolean tests Angular's `signal`, not this code |
| `data/badge.ts`, `data/bot-users.ts`, `data/user-roles.ts` | `badgeIconUrl` is one `replaceAll`; `isBotUser` is `Array.includes`; `roleBadges` is five ordered `if`s against a constant list. Each is verified by reading it |
| `services/dash-host.ts`, `services/auth.guard.ts`, `services/auth.service.ts` | Behaviour depends on build-time `environment` and `window.location`, and the guard redirects by assigning `window.location.href`. What they do is better proven by loading both hosts than by mocking the globals that decide it |
| `app.ts`, `*.module.ts`, `app-routing-module.ts`, `environments/` | Configuration. A wrong route is caught the first time the page is opened; the build catches the rest |
| `scroll-bar.directive.ts`, `squeezeLabels`, `page-scroll-bar` reveal behaviour | Needs real layout — `getComputedTextLength`, element boxes, pointer positions. jsdom reports zeroes for all of it, so a passing test would prove nothing |

## Budget

Roughly 15 spec files and somewhere near 1,200–1,600 lines once both tiers are in — a ratio around
**0.25:1** against source, down from 1.73:1. If a change would push it much past that, it is a signal
to re-read the rule above rather than to raise the budget.

## Running

```bash
npm test --prefix frontend
```

The runner is Vitest on jsdom via `@angular/build:unit-test`. With no spec files present it exits with
`No tests found matching the following patterns` — expected until the first Tier 1 file lands.
