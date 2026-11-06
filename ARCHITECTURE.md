# Architecture

helpdesk comes in two editions with the same features:

- **The app** (`src/`): React and TypeScript, built with Vite into one self-contained `dist/index.html`.
- **The single-file edition** (`single-file/index.html`): the original hand-written page, with no build step.

Both talk to a backend only through `window.helpdesk.use(name)` (see [PLATFORM.md](PLATFORM.md)), so one adapter serves both.

## Dependencies

Kept deliberately small. Runtime: `react`, `react-dom`. Build: `vite`, `@vitejs/plugin-react`, `typescript`. There is no router, state library, UI kit, chart library or test framework:

- **Views** are a value in the store (`S.view`), not URLs.
- **State** is one store object (below).
- **Charts and sparklines** are small SVG components.
- **Drag and drop** uses the browser's own drag events.
- **Unit tests** use Node's built-in test runner (`node --test`), which runs TypeScript directly.
- **Single-file output** comes from a 30-line plugin in `vite.config.ts`.

Please don't add a dependency without discussing it in an issue first.

## Styles

Every edition is also produced in each style in `styles/` (see [styles/README.md](styles/README.md)). A style is a stylesheet loaded after `src/styles.css` plus a small `style.json` with its colour themes and fonts; it changes look and layout with CSS only, so both editions need no code changes for a new style. `scripts/styles.mjs` makes the copies: `dist/<style>/index.html` after each build, and the committed `single-file/<style>/index.html` with `npm run styles`. A copy sets `window.HELPDESK_STYLE` before the app starts, which `SKINS` and the default preferences read (`constants.ts`, `state.ts`, and the same names in the single-file edition).

## Without sample data

Every copy also comes without sample data, in `clean/`. The app's is a second build, `vite build --mode clean` into `dist/clean/`: it sets `SAMPLE_DATA` (`constants.ts`) to `false` and swaps `demo-data.json` for nothing, so the sample data and every option to load or remove it are left out. The single-file edition's is made by `scripts/styles.mjs`, which removes the `demo-data` block, the section between the `standalone demo data` and `end of demo data` comments, and the setup link; `hasSampleData()` then turns the rest off. `npm run build` and `npm run styles` make the clean copies of every style too.

## Layout

```
src/
  main.tsx            start-up: render <App/>, then boot()
  App.tsx             header, the current view, the side panel, footer, dialogs
  styles.css          the stylesheet, shared with the single-file edition
  demo-data.json      fictional sample data
  core/               all logic, no React and no DOM access at import time
  ui/                 small shared components (avatars, chips, dialogs, icons)
  shell/              header, footer, toasts, announcement, pinned messages, dialog router
  views/              one file per tab: Queue, MyDesk, Dispatch, History, Customers, Reports, Audit, admin/
  panels/             the side panels: TicketPanel, CustomerPanel
  dialogs/            one file per dialog
tests/
  unit/               node --test, for src/core
  smoke.mjs           browser smoke test for both editions
single-file/          the single-file edition, and generated copies per style (single-file/<style>/) and
                      without sample data (single-file/clean/, single-file/clean/<style>/)
styles/               style packs: style.json + style.css per style
scripts/styles.mjs    makes the style and no-sample-data copies (Node only, no packages)
public/               copied as-is into dist/: platform.example.js, adapter-test.html
```

## The store

`src/core/state.ts` exports:

- `S`: everything on screen (tickets, customers, settings, the current view, filters…).
- `P`: the signed-in person's preferences.
- `commit()`: call after changing `S` or `P`; components re-render (calls are batched).
- `toast(msg, mood)`, `openDialog(d)`, `closeDialog()`, `setView(v)`.

Components call `useApp()` (from `src/ui`) at the top, read `S` and `P` while rendering, and change things only by calling actions from `src/core`. Purely visual state (a draft in a text box, whether a menu is open) lives in the component with `useState`.

Data comes from the backend through `src/core/data.ts`: `boot()` subscribes to every collection and keeps `S` up to date; writes go through `putDoc`, `delDoc` and `patchTicket`, which update `S` straight away and then save.

## Dialogs

Only one dialog is open at a time: `S.dialog` (see the `Dialog` type in `types.ts`). Actions open one with `openDialog({kind: …})`, and `shell/Dialogs.tsx` renders it. Dialog components use `<Dialog>` and `<DialogTop>` from `src/ui`.

## Styling

`styles.css` is shared with the single-file edition, so components keep the same class names and element ids (`#detail`, `#toast`, `.tile`, `.chip`…). Themes are CSS variables switched by `data-skin` and `data-density` on `<html>`; `applyPrefs()` sets them.

## Core modules

Every function keeps the name it has in the single-file edition, so the two are easy to compare. Functions there that built HTML strings are components here; functions that read form fields take values as arguments instead.

| Module | What's in it |
|---|---|
| `art.ts` | Icon paths, `icon()`, `mascot()` |
| `state.ts` | `S`, `P`, `svc`, `ref`, `commit`, `subscribe`, `toast`, `openDialog`, `closeDialog`, `setView` |
| `types.ts` | Data shapes |
| `constants.ts` | `SEV`, `STATUSES`, `ST_LABEL`, `ACTIVE`, `RUN`, `TEAMS`, `CATEGORIES`, `EV_LABEL`, `APP_VERSION`, `LS_KEY`, `LS_PREF`, `LS_COL`, `SKINS`, `skinKind`, `CHANNELS`, `TIERS`, `PHASES`, `SEC_CATS`, `AVAIL`, `DAYS`, `TZS`, `TONES`, `EM_EVENTS`, `EM_SHORT`, `ROUTE_LABEL`, `CH_FIELDS`, `IMP_COLS`, `BK_COLS`, `BK_NAMES`, `STOP` |
| `format.ts` | `esc`, `pad`, `abs`, `dur`, `rel`, `shortDate`, `fmtMin`, `parseMin`, `fmtHrs`, `hm`, `plural`, `initials`, `tone`, `slug`, `toLocalInput`, `localNow`, `median`, `linkify`, `snippetParts` |
| `config.ts` | `DEF_CFG`, `normCfg`, `setCfg`, `tgText`, `saveCfg`, `announcePost`, `announceClear` |
| `prefs.ts` | `cleanPrefs`, `systemDark`, `effectiveSkin`, `applyPrefs`, `setPref`, `initPrefs` |
| `hours.ts` | `tzParts`, `tzOffset`, `wallToUtc`, `dayWindow`, `workBetween`, `addWork`, `target`, `sla`, `workStatus` |
| `people.ts` | `photoOf`, `whoText`, `staffOf`, `mTeams`, `staffName`, `staffSorted`, `activeCount`, `custOf`, `custName`, `isMgr`, `canEditCfg`, `canRequest`, `permBlock`, `shiftKey`, `shiftOf`, `onShift`, `canTake`, `assignBlock`, `staffKey`, `staffByKey`, `resolveNames` |
| `data.ts` | `boot`, `enqueue`, `index`, `applyLocal`, `saveLocal`, `loadLocal`, `withRetry`, `writeFailed`, `actor`, `indexCust`, `loadCol`, `saveCol`, `applyCol`, `putDoc`, `delDoc`, `logEvent`, `newId`, `heartbeat`, `save`, `loadDemo`, `removeSamples` |
| `tickets.ts` | `genId`, `nextIdNum`, `maxIdNum`, `allocId`, `createTicket`, `patchTicket`, `setField`, `reopenForCustomer`, `assign`, `addNote`, `addTimeline`, `startIncident`, `needsResolve`, `changeStatus`, `submitResolve`, `takeTicket`, `myActive`, `clockOut`, `setShift`, `sweep`, `runSweep`, `noteMins`, `siteOf`, `openTicket`, `closePanel`, `moveOptions` |
| `customers.ts` | `newCustId`, `createCustomer`, `updateCustomer`, `custField`, `custSla`, `saveContact`, `removeContact`, `uploadLogo`, `removeLogo`, `saveSite`, `removeSite`, `callerMatches` |
| `staff.ts` | `staffId`, `addStaff`, `updateStaff`, `removeStaff`, `resizePhoto`, `uploadStaffPhoto`, `setTeams`, `deleteTeam` |
| `routing.ts` | `routeOrder`, `routeState`, `handedBack`, `routePick`, `routeEvents`, `routeTicket`, `routeWaiting`, `routeLine`, `saveRouting` |
| `queues.ts` | `sanId`, `qKey`, `tkKey`, `queueOf`, `orderCol`, `colTickets`, `colOwner`, `planMove`, `moveInQueue`, `saveQueue`, `resetQueue`, `prio`, `dispatchGroups` |
| `requests.ts` | `allRequests`, `myRequests`, `safePhoto`, `chValue`, `reqText`, `newReqId`, `openRequest`, `sendRequest`, `b64ToBlob`, `decide`, `approveRequest`, `seenSet`, `noticeChanges`, `chime` |
| `emails.ts` | `lastResolution`, `emailTo`, `emailVars`, `fillTpl`, `mkEmail`, `composeUrl`, `setEmail` |
| `similar.ts` | `toks`, `tTok`, `similar` |
| `share.ts` | `standalone`, `ticketLink`, `shareParts`, `sharePlain`, `shareHtml`, `copyShare` |
| `queue.ts` | `activeFilters`, `matchBase`, `matchStatus`, `sortTickets`, `perDay`, `customers`, `resetFilters` |
| `history.ts` | `closeInfo`, `histKey`, `histHit`, `histRows`, `loadOlderClosed` |
| `reports.ts` | `repSet`, `tally` |
| `audit.ts` | `evText`, `eventText`, `auditRows` |
| `exports.ts` | `csv`, `exportTickets`, `exportAudit`, `exportTime`, `exportHistory`, `downloadTimeline` |
| `csvimport.ts` | `parseCSV`, `csvObjects`, `importTemplate`, `sevFrom`, `statusFrom`, `tierFrom`, `chanFrom`, `dateFrom`, `planCustomers`, `planTickets`, `readImport`, `runImport` |
| `backup.ts` | `fetchAll`, `objOf`, `makeBackup`, `readRestore`, `runRestore` |
| `diagnostics.ts` | `diagInfo`, `copyDiagnostics` |
| `pins.ts` | `pinsFor`, `savePin`, `removePin` |
| `setup.ts` | `setupSkipped`, `setupSkip`, `setupSave`, `maybeSetup` |

### Functions whose shape changed from the single-file edition

| Function | Here |
|---|---|
| `changeStatus(id, to, force?)` | Opens `{kind:"resolve"}` when a resolution note or time is required; `{kind:"request"}` when an agent asks to reopen. |
| `submitResolve(id, to, {text, internal, minutes, billable})` | Returns an error message, or `null` once saved. |
| `openRequest(payload)` | Builds the draft and opens `{kind:"request", draft}`. `sendRequest(draft, message)` sends it. |
| `decide(requestKey, itemId, approve, reason?)` | Approve or decline one request item. |
| `clockOut()` | Opens `{kind:"clockOut"}` when you have active tickets; otherwise clocks out. |
| `readImport(kind, file)` / `readRestore(file)` | Read the file and open `{kind:"import", plan}` / `{kind:"restore", data}`. |
| `runImport(plan, onProgress)` / `runRestore(data, onProgress)` | Save it; `onProgress(done, total)`. |
| `routeLine(category)` | Returns `{text, tone}` describing who a new ticket would go to (or `null`), not HTML. |
| `savePin(id \| null, fields)` / `setupSave(values)` | Return an error message, or `null` once saved. |
| `audit.ts` text helpers | Return plain text; components show names with `<Who/>` where it matters. |
| `snippetParts(text, query)` | `{before, match, after}` for highlighting a search match. |
| `linkify(escapedHtml)` | Still returns HTML. Only used for pinned messages, on text already passed through `esc()`. |
| `maybeSetup()` | Opens `{kind:"setup"}` for a manager on an empty helpdesk with no saved settings. |
| Customer actions (`custField`, `custSla`, `saveContact`, `saveSite`, `removeContact`, `removeSite`, `uploadLogo`, `removeLogo`) | Act on the open customer (`S.selCust`), with an optional customer id as the last argument. `saveContact(id, fields)` and `saveSite(id, fields)` take `"new"` or an existing id and return an error message or `null`. |
| `submitResolve`, `savePin`, `setupSave` | Return an error message to show, `""` when saving failed (a toast already explains), or `null` once saved; they close their dialog on success. |
| `decide(uid, requestId, approve, reason?)` | Resolves `true` when done. Approving toasts "Approved."; the caller toasts "Declined.". |
| `sendRequest(draft, message)` | Returns an error message, `false` to keep the dialog open, or `null` once sent. |
| `shareParts`, `sharePlain`, `shareHtml`, `copyShare` | Take `(ticket, {desc, note})`; `copyShare` resolves `false` if the browser blocked copying. |
| `runImport`, `runRestore` | Resolve `true` once saved and close the dialog; they throw on failure. |
| `openTicket(id)`, `closePanel()` | Only change `S.sel` / `S.selCust`; the panel resets its own drafts. |

## Tests

- `npm test` runs the unit tests in `tests/unit/` (Node's test runner, TypeScript run directly). `parity.test.ts` checks the logic against values produced by the single-file edition; `tests/unit/index.js` exists so Node 22 finds the tests.
- `npm run smoke` runs `tests/smoke.mjs`, which opens both editions in a browser. It needs Playwright, installed only for the test: `npm install --no-save playwright && npx playwright install chromium`.
