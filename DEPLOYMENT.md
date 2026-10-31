# Deploying helpdesk for a team

helpdesk is the front end only. To share one helpdesk across a team you provide three things yourself:

1. **Somewhere to serve the page:** any static host or the included Docker image.
2. **A backend:** an API and database that store tickets and push changes to everyone live.
3. **Sign-in:** so the helpdesk knows who each person is and whether they're a manager, agent or viewer.

The page connects to your backend through a small adapter script, `platform.js`. This guide covers the whole path. [`PLATFORM.md`](PLATFORM.md) is the detailed reference for what the adapter must do.

```
 browser                                   your systems
┌──────────────────────────────┐         ┌──────────────────────────┐
│ index.html (either edition)  │         │ API + database           │
│ ↓ window.helpdesk.use("db")  │  HTTPS  │ live updates (WebSocket) │
│ platform.js (your adapter) ──┼────────►│ sign-in (OIDC / SAML)    │
└──────────────────────────────┘         │ file storage (/_blob/)   │
                                         └──────────────────────────┘
```

## Contents

- [1. Try it first](#1-try-it-first)
- [2. Choose a backend](#2-choose-a-backend)
- [3. Write your adapter](#3-write-your-adapter)
- [4. Check it with the adapter test](#4-check-it-with-the-adapter-test)
- [5. Serve the page](#5-serve-the-page)
- [6. First run, importing and restoring](#6-first-run-importing-and-restoring)
- [Background jobs](#background-jobs)
- [Backups and updates](#backups-and-updates)
- [Self-hosting the fonts](#self-hosting-the-fonts)
- [Troubleshooting](#troubleshooting)
- [Go-live checklist](#go-live-checklist)

## 1. Try it first

- **On its own:** open `single-file/index.html`, or run `npm install && npm run build` and open `dist/index.html`. It runs in single-browser mode, saving to that browser.
- **As if shared:** copy `public/platform.example.js` to `platform.js` next to the page you're using, uncomment `<script src="platform.js"></script>` in the page's `<head>`, and serve the folder (for example `python3 -m http.server`). For the app you can uncomment it in the root `index.html` and run `npm run dev` instead. Open it in two tabs: changes in one appear in the other. Add `?as=agent` or `?as=viewer` to the address to see the other roles.

The example adapter keeps everything in the browser. It is not shared between computers and not secure, so it's for trying things out only.

## 2. Choose a backend

Anything that can store JSON documents, enforce per-role rules and push changes to the browser will do. Some common fits:

| If you run… | Data | Live updates | Sign-in | Files |
|---|---|---|---|---|
| **Microsoft 365 / Azure** | Cosmos DB (or Azure SQL with JSON columns) behind App Service or Functions | Azure Web PubSub or SignalR | Entra ID app roles | Blob Storage |
| **Firebase** | Firestore (its API is very close to the one the page uses) | Firestore listeners | Firebase Auth or your SSO | Cloud Storage |
| **Supabase** | Postgres table per collection, or one `documents` table with `jsonb` | Realtime | Supabase Auth or your SSO | Storage |
| **Self-hosted** | Node or Python API on Postgres or SQLite | WebSockets or Server-Sent Events | Your existing OIDC or SAML provider | Disk or S3-compatible storage |

Whatever you pick, plan for:

- **Roles.** Map your groups or app roles to *manager*, *agent* and *viewer*.
- **Access rules on the server.** The table in [PLATFORM.md](PLATFORM.md#collections) lists who may write each collection. The page only hides buttons, so the API must refuse anything a role isn't allowed to do.
- **A document model.** Paths look like `tickets/HD-7K2QM` or `data/users/<uid>/prefs`. A single table keyed by path, holding a JSON body, is enough for most teams.

## 3. Write your adapter

Copy `public/platform.example.js` to `platform.js` and work through the sections marked `REPLACE`:

1. **Who is signed in:** return `{id, name, avatarUrl, role}` from your sign-in system. `id` must never change for a person (an Entra ID object id, for example).
2. **Storage:** turn `get`, `set`, `update`, `delete` and queries into calls to your API, and feed change notifications from your server into the `listeners` so `onSnapshot` callbacks fire.
3. **File storage:** implement `upload` and `delete`, and serve `/_blob/{id}` from your server. Or leave it as `null` to hide logo and photo uploads.
4. **Access rules:** keep the checks in the adapter if you like, but enforce the same rules in your API.

Behaviours that are easy to miss:

- `onSnapshot` must call back **straight away**, including for a document that doesn't exist yet (`exists: false`).
- `update()` on a missing document must **reject** with `{code: "invalid_argument"}`.
- Queries need `orderBy`, `limit` (up to 1,000) and `where` with `==` and `<`.
- Errors are objects with a `code`: `invalid_argument` for bad requests and anything not allowed, `unavailable` for temporary failures (the page retries once).

## 4. Check it with the adapter test

Serve `adapter-test.html` (from `public/`, or `dist/` after a build) next to your adapter and open it. It runs about 20 checks: reading and writing, merging updates, rejecting bad updates, ordered and filtered queries, live updates, unsubscribing, locking, file storage and role rules.

- Run it once **signed in as a manager** and once **as an agent**. The role check expects managers to be able to write settings and agents not to.
- It writes to a temporary `_adaptertest` collection and deletes what it creates, so allow that collection while testing.
- **Copy results** gives you a text report to keep or share.

Admin → **System** inside the app shows the same picture from the app's side: which services connected, whether locking and filtered queries are available, and **Copy diagnostics** for bug reports (no names, emails or ticket content).

## 5. Serve the page

Either edition is a static page: `dist/index.html` (after `npm run build`) or `single-file/index.html`, plus your `platform.js`. Any of these work:

- **Docker:** `docker build -t helpdesk . && docker run -p 8080:8080 helpdesk`. The image builds the app and serves it at `/`, with the single-file edition at `/single-file/`. It's nginx with the config in `nginx.conf`, which adds security headers from `security-headers.inc`, stops caching of `index.html` so updates show straight away, and hides `platform.example.js`.
- **Your existing web server or CDN:** copy the files across and add the headers from `security-headers.inc`.
- **The same app as your API:** serve the page from your backend, which avoids cross-origin setup entirely.

Serve it over **HTTPS**. If your API is on a different domain, add it to `connect-src` in the Content Security Policy and allow the page's origin in your API's CORS settings.

## 6. First run, importing and restoring

The first manager to open a fresh helpdesk gets a short **setup**: name, ticket ID prefix, teams, categories, time zone and working hours. Everything can be changed later in Admin.

To bring data across, open Admin → **Access and data**:

- **Import from a spreadsheet:** CSV for customers and contacts, and for tickets. Download the templates to see the columns; common alternative names such as *Company*, *Title* or *Assigned to* are recognised. You get a preview with warnings before anything is saved. Ticket IDs in the file are kept, customers that don't exist yet are created, and assignees who aren't on the team list are kept as names you can link later.
- **Restore from backup:** load a backup file made by any helpdesk, for example the single-browser version you tried things out on.

## Background jobs

Some jobs run in the browser of whoever has the helpdesk open. With no one online, they wait. Admin → System shows which are switched on. For a real deployment, run them on a schedule on your server (every few minutes is plenty) and they'll happen on time whether anyone is online or not. The browser versions stay harmless: they check the ticket's state before acting, so the first one to run wins.

All settings below live in `config/settings`.

| Job | When | What to do |
|---|---|---|
| **End of grace period** | `status == "closing"` and `closingUntil <= now` | Set `status: "closed"`, `closingUntil: null`, `updatedAt: now`. Append `{type:"status", from:"closing", to:"closed", auto:true, reason:"The grace period ended", at:now}` to `history`. |
| **Auto-close** | `rules.autoCloseDays > 0`, `status == "resolved"` and `resolvedAt` older than that many days | If `rules.graceDays > 0`, set `status: "closing"` and `closingUntil: now + graceDays`; otherwise `status: "closed"`. Append a `status` history entry with `auto:true`. |
| **Auto clock-out** | `requireShift` is on, `rules.maxShiftHours > 0`, and a `shifts` document has `on: true` with `since` older than that | Set `on: false` and add an `events` entry `{type:"shift", ...}`. |
| **Auto-assign retries** | `routing.on` and `routing.retry` are on, and an active ticket has no assignee | Walk `routing.cats[ticket.category]` in order and assign the first person who is clocked in, available and under `rules.maxActive`. Append `{type:"assignee", auto:true, reason:...}` to `history`. |
| **Customer emails** | An entry in `tickets[].emails` has `status: "pending"` | Optional: send it from a shared mailbox (for example through Microsoft Graph) and set `status: "sent"`. Otherwise agents send them from their own mail client. |

The exact logic is in `runSweep()` (`src/core/tickets.ts`) and `routeWaiting()` (`src/core/routing.ts`), and under the same names in `single-file/index.html`, if you want to mirror it line for line. Have the server write `history` and `events` entries itself, and refuse edits to old ones, so the audit trail can't be rewritten from a browser.

## Backups and updates

- **Back up your database** with its own tools on a schedule. Admin → Access and data → **Download full backup** is a handy extra: one portable JSON file you can restore into any helpdesk (format in [PLATFORM.md](PLATFORM.md#backup-file-format)).
- **Before updating**, read [`CHANGELOG.md`](CHANGELOG.md) for anything that needs action, and take a backup.
- **To update**, rebuild the app (or replace `single-file/index.html`) and keep your `platform.js`. The version shows in Admin → System.

## Self-hosting the fonts

The page loads Bricolage Grotesque, Geist and Geist Mono from Google Fonts and falls back to system fonts without them. To serve them yourself (for privacy rules or networks without internet access):

1. Download the fonts (all are under the SIL Open Font License) as `woff2` files into a `fonts/` folder.
2. Replace the Google Fonts `<link>` tags in the page's `<head>` (the root `index.html` for the app, or `single-file/index.html`) with `@font-face` rules pointing at those files.
3. Remove `fonts.googleapis.com` and `fonts.gstatic.com` from `security-headers.inc`.

## Troubleshooting

| You see | Likely cause |
|---|---|
| "Running on its own" and data only in one browser | `platform.js` isn't loaded, or `use("db")` returned `null`. Check the `<script>` tag is uncommented and comes before the app script. |
| First-run setup never appears | `onSnapshot` on `config/settings` doesn't call back while the document doesn't exist. |
| Changes only show after a reload | Change notifications aren't reaching `onSnapshot` listeners. |
| "That change wasn't saved" | The API rejected a write. Check the role rules, and that `update()` targets documents that exist. |
| Logos and photos don't show | `/_blob/{id}` isn't served, or `assets` isn't provided. |
| History can't load older tickets | `where()` isn't supported by the adapter. |
| Agents can see Admin | `canEdit()` returns `true` for agents. It must be `true` for managers only. |

When reporting an issue, include **Copy diagnostics** from Admin → System and the **Copy results** from the adapter test.

## Go-live checklist

- [ ] The adapter test passes as a manager and as an agent, with no failures.
- [ ] Access rules are enforced by the API, not only in the adapter.
- [ ] People sign in with your identity provider, with multi-factor authentication, and roles come from your groups or app roles.
- [ ] The page and API are served over HTTPS with the security headers in place.
- [ ] Background jobs run on a schedule on the server.
- [ ] Database backups run automatically, and you've tried restoring one.
- [ ] `platform.example.js` isn't deployed, or is blocked, as in `nginx.conf`.
- [ ] Settings are filled in: Admin → General, Hours and SLA, Categories, Teams and Agents.
