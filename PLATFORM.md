# Running helpdesk on your own platform

`index.html` never talks to a server directly. Everything it needs from its host goes through one function:

```js
const db = await window.claude.use("db");   // "db" | "user" | "assets" | "downloads"
```

(The name comes from where the app started, as a Claude artifact; nothing else about it is Claude-specific.) To run helpdesk on your own infrastructure, load a small script **before** the app's own script that defines `window.claude.use` and returns objects with the interfaces below, backed by your own API. Nothing else in the page needs to change to get a working, shared, signed-in system. If `use()` returns `null` for a capability, the page degrades gracefully (with no `db`, it falls back to single-browser mode).

`index.html` has a commented-out tag in `<head>` ready for this:

```html
<script src="platform.js"></script>   <!-- your adapter, defines window.claude.use -->
```

**Start from [`platform.example.js`](platform.example.js).** It's a complete adapter that keeps data in the browser and syncs between tabs, with every part you need to replace marked `REPLACE`. Then open [`adapter-test.html`](adapter-test.html) to check your adapter does everything below. [`DEPLOYMENT.md`](DEPLOYMENT.md) walks through the whole process.

## 1. `db`: shared document store

A small Firestore-style API. Paths alternate collection/document (`tickets/HD-7K2QM`, `data/users/<uid>/prefs`).

| Call | Behaviour the page relies on |
|---|---|
| `db.collection(path)` | Returns a collection reference. |
| `db.doc(path)` | Returns a document reference. |
| `collection.doc(id)` | Document in that collection. |
| `collection.orderBy(field, "asc"\|"desc").limit(n)` | Used for `tickets` (by `createdAt`, 1000) and `events` (by `at`, 1000). |
| `collection.where(field, op, value)` and `query.get()` | History uses `where("status","==","closed").where("createdAt","<",oldest).orderBy("createdAt","desc").limit(500).get()` to load closed tickets older than the live 1000. Needs `==` and `<`. |
| `query.onSnapshot(next, error)` | Calls `next({docs:[{id, exists:true, data()}]})` straight away and again on **every change by anyone**. Returns an unsubscribe function. This is what makes the queue live. |
| `collection.get()` (no filters) | Used by the full backup to read every ticket and audit entry, 1,000 at a time with `orderBy` and `where("<")`. |
| `doc.get()` | Resolves `{exists, data()}`. |
| `doc.set(obj)` | Creates or fully replaces the document. |
| `doc.update(obj)` | Merges top-level fields (nested objects merge, arrays are replaced). Must **reject** with `{code:"invalid_argument"}` if the document doesn't exist. |
| `doc.delete()` | Deletes it. |
| `doc.onSnapshot(next, error)` | Live updates for one document (`config/settings`). Must call back straight away **even when the document doesn't exist yet** (with `exists: false`); the page waits for that before showing first-run setup. |
| `doc.acquire({holder, ttlMs})` | *Optional.* A short lease so only one browser does a job at a time (handing out the next ticket number for a customer, auto-assigning a waiting ticket). Resolves `{acquired: true|false}`. If you leave it out the page still works, with a small chance of two browsers acting at once.

Errors are rejected as `{code, message}` with `code` one of `invalid_argument` (bad call or **not allowed**), `unavailable` (temporary; the page retries once), `quota_exceeded`, `resource_exhausted`, `revoked`.

### Collections

| Path | Holds | Who may write |
|---|---|---|
| `tickets/{id}` | Tickets, including notes, history, timeline and queued emails | Agents and managers |
| `customers/{id}` | Customers, contacts, sites, SLA overrides | Agents and managers |
| `events/{id}` | Audit entries for non-ticket changes | Agents and managers (append only) |
| `config/settings` | Workspace settings: teams, categories, hours, SLA, rules, email templates | Managers only |
| `staff/{id}` | Agent records: teams, title, availability, photo, Office 365 address | Managers only |
| `queues/{key}` | Manual Dispatch order per agent | Managers only |
| `shifts/{key}` | Clock-in state | Managers; each person their own (`shifts/{uid}`) |
| `requests/{uid}` | An agent's requests to managers | Each agent their own; only managers read all |
| `decisions/{requestId}` | Managers' answers to requests | Managers only (everyone reads) |
| `counters/{PREFIX}` | Next ticket number per customer prefix, e.g. `counters/FAI` → `{next: 9}` | Agents and managers |
| `data/users/{uid}/prefs` | Personal preferences (theme, layout) | That person only, private |
| `_adaptertest/{id}` | Temporary documents written and deleted by `adapter-test.html` | Agents and managers, while testing |

**These rules must be enforced on the server.** The page only hides controls a person can't use; anyone can call your API directly.

### Settings used for migration

`config/settings.routing` holds auto-assign: `{on, retry, cats: {"<category>": ["u:<userId>" | "l:<name>", ...]}}`, best agent first. `customers/{id}.idPrefix` (1–6 letters/digits, e.g. `FAI`) and `idStart` (next number) give that customer ticket ids like `FAI8`; customers without a prefix get `HD-XXXXX`.

### Ticket shape (main fields)

`subject, description, status (new|open|pending|resolved|closing|closed), severity (S1–S4), team, category, channel, customerId, customer, contactId, siteId, site, requesterName, requesterEmail, requesterPhone, assigneeId | assigneeLabel, createdAt, updatedAt, resolvedAt, closedAt, closingUntil, createdBy, notes[], history[], timeline[], incident, emails[], imported`. Times are ISO 8601 strings in UTC. `imported: true` marks tickets and customers brought in from CSV.

### Backup file format

Admin → Access and data → **Download full backup** writes one JSON file:

```json
{
  "format": "helpdesk-backup",
  "formatVersion": 1,
  "app": "1.0.0",
  "exportedAt": "2026-10-31T09:00:00.000Z",
  "exportedBy": "Morgan Manager",
  "collections": {
    "config":   { "settings": { } },
    "tickets":  { "<id>": { } },
    "customers": { }, "staff": { }, "queues": { }, "shifts": { },
    "events": { }, "counters": { }, "requests": { }, "decisions": { }
  }
}
```

Each collection maps document IDs to document bodies, exactly as stored. Restoring writes every document back with `set()`, replacing ones with the same ID and leaving everything else alone. The same file is a convenient way to seed a new server or move between backends.

## 2. `user`: who is signed in

| Call | Returns |
|---|---|
| `me()` | `{id, name, avatarUrl, isOwner}`. `id` is a stable, opaque id; it is what tickets store as `assigneeId`, `by` and so on. |
| `can("data.write")` | `true` for agents and managers, `false` for view-only users. |
| `canEdit()` | `true` for **managers**. This one flag unlocks Admin, assigning to others, approving requests and settings. |
| `profiles(ids)` | `{[id]: {id, name, avatarUrl, isMe}}` for the ids on screen. |
| `search(query)` | Up to 8 `{id, name, avatarUrl}` matches from your directory, for adding agents and assigning. |

With Microsoft Entra ID, map app roles to these: **Manager** → `canEdit()` true, **Agent** → `can("data.write")` true, **Viewer** → both false. Use the Entra object id as `id`.

## 3. `assets`: logos and profile photos

| Call | Behaviour |
|---|---|
| `upload(blob)` | Stores the file, resolves `{id, url}`. `id` must be 32 lowercase hex characters. |
| `delete(id)` | Removes it. |

The page displays stored images from **`/_blob/{id}`**, so serve that path (for example, a route that streams from Blob Storage).

## 4. `downloads`: CSV and timeline exports

`save({filename, data})` gives the user the file. A plain browser download (a `Blob` and an `<a download>` link) is enough. If `use("downloads")` returns `null`, the page does exactly that itself.

## Things to move to the server

Out of the box these run in the browser of whoever has the page open (Admin → System lists them). On your own platform they belong in a scheduled job or the API; see [`DEPLOYMENT.md`](DEPLOYMENT.md#background-jobs):

- **Automations:** ending the closing grace period, auto-closing resolved tickets, automatic clock-out, and auto-assigning waiting tickets when someone becomes free.
- **Assignment and clock-in rules:** currently checked in the page.
- **Audit history:** the page appends to `history[]` and `events`. Have the API add these entries itself and refuse edits to old ones.
- **Emails:** the page queues emails on `tickets[].emails` for an agent to send. A server can send them directly (for example through Microsoft Graph from a shared mailbox) and mark them as sent.
