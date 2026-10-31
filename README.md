# helpdesk

A free, open-source ticketing system for IT, security and networking teams. It's one HTML file: no build step, no framework, nothing to install.

Open `index.html` in a browser and it works straight away, saving to that browser. Connect it to a backend (see [Running it for a team](#running-it-for-a-team)) and it becomes a shared, signed-in helpdesk for a whole team.

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
- **Admin, Reports and Audit log.** Manager-only settings, reporting, and a record of every change with who made it.
- **Themes.** Light, Dark or System, with five colour themes, and Ping, an optional mascot who can be squished.

## Try it

Open `index.html` and choose **Load sample data** on the Queue page. Everything is fictional and stays in your browser.

On its own like this, it's a single-user demo: there's no sign-in, so you have full access including Admin, shift rules aren't enforced, and logo uploads and CSV exports are unavailable.

### GitHub Pages

1. In the repository, go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Pick `main` and `/ (root)`, then save.
4. The page appears at `https://<your-username>.github.io/<repo-name>/` after a minute or so.

## Hosting it for your team

This project is the app only. It doesn't ship a server, database or sign-in, so to share one helpdesk across a team you host it yourself, on whatever you already run.

The page reaches its backend through one function, `window.claude.use(name)` (the name comes from where the app started), which returns four services: a database, the signed-in user, file storage and downloads. [`PLATFORM.md`](PLATFORM.md) describes each one, the data the app stores and the access rules your server must enforce. Write a short adapter script that provides those four services from your own systems, load it before the app, and nothing in `index.html` needs to change.

**Some starting points** (suggestions, not requirements):

- **Microsoft 365 shops:** Entra ID for sign-in and roles, an API on Azure App Service or Functions, Cosmos DB for data, Blob Storage for logos and photos, and Web PubSub for live updates.
- **Firebase or Supabase:** their auth, document or Postgres database and storage map closely onto the four services, and both push live changes to the browser.
- **Self-hosted:** a small Node or Python server with Postgres or SQLite, your existing SSO (OIDC or SAML), and WebSockets for live updates.

Whatever you choose, enforce the access rules on the server. The page only hides controls a person can't use.

If you get stuck, open an issue with what you're running and we'll try to help.

## Customising

Everything lives in `index.html`. The name, ticket ID prefix, teams, categories, working hours, SLA targets, email templates and rules are all set from **Admin** in the app, so most teams won't need to touch the code.

The only external requests are Google Fonts (Bricolage Grotesque, Geist and Geist Mono), and the page falls back to system fonts without them.

## Licence

[MIT](LICENSE)
