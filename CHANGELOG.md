# Changelog

Notable changes to helpdesk. Versions follow [semantic versioning](https://semver.org): a new major version means something needs action when you update, so read its notes first.

## 2.0.0 (2026-10-31)

helpdesk now comes in two editions with the same features.

### Added

- **The app, built with React and TypeScript** (`src/`). Vite builds it into one self-contained `dist/index.html`, so it opens and hosts just like before. Dependencies are kept to React (to run) and Vite and TypeScript (to build); everything else, including the single-file build step, tests and drag and drop, uses what React, the browser and Node already provide.
- **Unit tests** for the logic (`npm test`, using Node's built-in test runner), including checks that the app's calculations match the single-file edition's.
- **`ARCHITECTURE.md`**, explaining how the app is organised for contributors.
- **GitHub Pages workflow** that builds the app and publishes both editions.

### Changed

- **Repository layout.** The original page is now the single-file edition in `single-file/index.html`. Apart from the version number, the stylesheet fix below and a note about where `platform.example.js` now lives, it's unchanged. The root `index.html` is the app's development entry point, so open `dist/index.html` after `npm run build` instead.
- **`platform.example.js` and `adapter-test.html` moved to `public/`.** They're copied into `dist/` when you build. Your own `platform.js` works with both editions without changes.
- **Docker** now builds the app and serves it at `/`, with the single-file edition at `/single-file/`.
- **GitHub Pages** publishes through GitHub Actions instead of from the branch. In Settings → Pages, set the source to **GitHub Actions**.
- The GitHub check now type-checks, runs the unit tests, builds, and smoke-tests both editions.

### Fixed

- Two Auto-assign layout rules in the stylesheet were being ignored because of a stray escape character (both editions).

## 1.1.0 (2026-10-31)

### Added

- **Pinned messages.** Managers can pin notes to the top of the Queue, Dispatch or both, with a style (note, information, warning, critical) and an optional time to unpin automatically. Everyone can hide the pinned strip for themselves. Pins are stored in a new `pins` collection (managers write, everyone reads), included in backups, and recorded in the audit log.

### Changed

- **The adapter hook is now `window.helpdesk.use`.** If you wrote a `platform.js` against 1.0.0, rename the hook there; `platform.example.js` and `adapter-test.html` are updated.
- Wording throughout the app now refers to "your organisation's sign-in" rather than a specific platform.
- Without a backend, the "saved in this browser only" banner is gone; the footer still shows "This browser only".

## 1.0.0 (2026-10-31)

First public release.

### The app

- Queue, My desk, Dispatch and History (closed tickets), with board and list views.
- Customers with contacts, sites, priority tiers, per-customer SLA targets and per-customer ticket ID prefixes.
- Auto-assign by category, using a ranked list of agents per category.
- SLAs in working hours with bank holidays, paused while pending.
- Time tracking, incident timelines, shifts, requests to managers, customer emails and sharing to Teams.
- Admin, Reports and Audit log.
- Light, dark and system themes, and Ping, a terminal mascot that changes colour with the theme.

### Deployment tools

- **First-run setup** for a new helpdesk: name, prefix, teams, categories and working hours.
- **Full backup and restore** as one JSON file, from Admin → Access and data.
- **CSV import** for customers and contacts, and for tickets, with templates and a preview.
- **Admin → System**: version, connected services, background jobs and copyable diagnostics.
- **`platform.example.js`**: a working reference adapter to build your backend connection from.
- **`adapter-test.html`**: checks an adapter does everything the app needs.
- **Docker and nginx** setup with security headers, and a GitHub Actions check with a browser smoke test.
- Exports and downloads now work without a backend, as ordinary browser downloads.
