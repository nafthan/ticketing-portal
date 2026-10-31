# helpdesk

A free, open-source ticketing system for IT, security and networking teams.

Open it in a browser and it works straight away, saving to that browser. Connect it to a backend (see [Hosting it for your team](#hosting-it-for-your-team)) and it becomes a shared, signed-in helpdesk for a whole team.

## Two editions

Both have the same features, look the same and use the same backend adapter. Pick whichever suits you.

| | The app | The single-file edition |
|---|---|---|
| **What it is** | React and TypeScript in `src/`, built with Vite | One hand-written `single-file/index.html` |
| **To use it** | `npm install && npm run build`, then open or host `dist/index.html` (one self-contained file) | Open or host `single-file/index.html`. Nothing to install or build. |
| **Best for** | Teams who'll customise or contribute; easier to work on and test | Trying it out, or hosting with no tooling at all |

The app keeps its dependencies to the minimum: React to run, and Vite and TypeScript to build. See [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Features

- **Queue, My desk, Dispatch and History.** Every ticket by status; each agent's tickets in priority order; a board of who is working on what; and a searchable archive of closed tickets. My desk, Dispatch and History each switch between a board and a list.
- **Auto-assign by category.** Give each category a ranked list of agents, and new tickets go to the highest-ranked agent who is clocked in, available and under their ticket limit. Tickets nobody can take wait until someone on the list clocks in.
- **Customers.** Contacts, sites, logos, priority tiers, per-customer SLA targets, and a ticket ID prefix per customer (`ACME1`, `ACME2`, …). Choosing a caller fills in their company and site.
- **SLAs.** Count working hours and bank holidays, and pause while a ticket is pending.
- **Time tracking.** Billable and non-billable time on every ticket, with CSV export.
- **Incident timelines.** A phase-by-phase record for security incidents, downloadable as Markdown.
- **Shifts.** Clock in and out; optionally, tickets can only be taken while on shift.
- **Requests.** Agents ask a manager to reassign, reorder, reopen or change a photo; managers approve from a notification bell.
- **Emails and Teams.** Automatic customer emails, queued to send from your own mail client, and a Share button that drafts a Teams message.
- **Pinned messages.** Managers pin notes to the top of the Queue and Dispatch, like a changed on-call number or a known issue, with an optional expiry.
- **Admin, Reports and Audit log.** Manager-only settings, reporting, and a record of every change with who made it.
- **Themes.** Light, Dark or System, with five colour themes, and Ping, an optional terminal mascot who changes colour with the theme and can be squished.
- **Easy to move in.** First-run setup, CSV import for customers, contacts and old tickets, and full backup and restore as a single file.

## Try it

Open `single-file/index.html`, or build the app and open `dist/index.html`. A short setup asks for your helpdesk's name, teams and hours, or choose **Explore with sample data** to look around first. Everything is fictional and stays in your browser.

On its own like this, it's a single-user demo: there's no sign-in, so you have full access including Admin, shift rules aren't enforced, and logo uploads are unavailable.

### Working on the app

```
npm install
npm run dev       # live-reloading development server
npm test          # unit tests
npm run build     # type-check and build dist/index.html
```

You'll need Node 22.6 or newer.

### GitHub Pages

The repository includes a workflow that builds the app and publishes both editions: the app at the site root and the single-file edition at `/single-file/`.

1. In the repository, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main` (or run the **Pages** workflow from the Actions tab). The site appears at `https://<your-username>.github.io/<repo-name>/`.

## Hosting it for your team

This project is the app only. It doesn't ship a server, database or sign-in, so to share one helpdesk across a team you host it yourself, on whatever you already run.

The page reaches its backend through one function, `window.helpdesk.use(name)`, which returns four services: a database, the signed-in user, file storage and downloads. Write a short adapter script that provides those from your own systems, load it before the app, and nothing else needs to change. The same adapter works with both editions.

What's here to help:

| File | What it's for |
|---|---|
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Step-by-step guide: choosing a backend, the adapter, hosting, background jobs, backups and a go-live checklist |
| [`PLATFORM.md`](PLATFORM.md) | Reference for the four services, the data the app stores and the access rules your server must enforce |
| [`public/platform.example.js`](public/platform.example.js) | A working adapter to start from, with the parts to replace clearly marked |
| [`public/adapter-test.html`](public/adapter-test.html) | Open it to check your adapter does everything the app needs |
| `Dockerfile`, `nginx.conf` | Build the app and serve both editions with nginx and sensible security headers |

Inside the app, Admin → **System** shows what's connected and has **Copy diagnostics** for bug reports.

**Some starting points** (suggestions, not requirements):

- **Microsoft 365 shops:** Entra ID for sign-in and roles, an API on Azure App Service or Functions, Cosmos DB for data, Blob Storage for logos and photos, and Web PubSub for live updates.
- **Firebase or Supabase:** their auth, document or Postgres database and storage map closely onto the four services, and both push live changes to the browser.
- **Self-hosted:** a small Node or Python server with Postgres or SQLite, your existing SSO (OIDC or SAML), and WebSockets for live updates.

Whatever you choose, enforce the access rules on the server. The page only hides controls a person can't use.

If you get stuck, open an issue with what you're running, plus the diagnostics and adapter test results, and we'll try to help.

## Customising

The name, ticket ID prefix, teams, categories, working hours, SLA targets, email templates and rules are all set from **Admin** in the app, so most teams won't need to touch the code. If you do, the app's code is organised by screen in `src/` ([`ARCHITECTURE.md`](ARCHITECTURE.md) explains how); the single-file edition is all in one file.

The only external requests are Google Fonts (Bricolage Grotesque, Geist and Geist Mono), and both editions fall back to system fonts without them.

## Contributing

Issues and pull requests are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md), and [`SECURITY.md`](SECURITY.md) for reporting security problems. Changes are listed in [`CHANGELOG.md`](CHANGELOG.md).

## Licence

[MIT](LICENSE)
