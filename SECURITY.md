# Security

## Reporting a vulnerability

Please don't open a public issue for security problems. Use **Report a vulnerability** on this repository's **Security** tab, which sends a private report to the maintainers.

Include what you found, how to reproduce it, and which version you're on (Admin → System shows it). We'll acknowledge the report, keep you updated while we fix it, and credit you in the changelog if you'd like.

## Supported versions

Fixes go into the latest release. Update to the newest `index.html` to get them; [`CHANGELOG.md`](CHANGELOG.md) lists what changed.

## How security works in helpdesk

helpdesk is a front end. Whoever hosts it is responsible for the backend, sign-in and data. Keep these points in mind:

- **The page is not a security boundary.** It hides buttons a person can't use, but anyone can call your API directly. Your server must enforce the access rules in [`PLATFORM.md`](PLATFORM.md#collections) on every request.
- **Sign-in belongs to your identity provider.** helpdesk has no passwords of its own. Turn on multi-factor authentication there.
- **The audit trail should be written by the server.** The page appends history and audit entries, but in production your API should add them and refuse edits to old ones.
- **`platform.example.js` is for trying things out.** It stores data in the browser and checks roles in the browser. Don't deploy it as your real adapter.
- **Text is escaped before it's shown.** Ticket and customer content is treated as untrusted and escaped before display, and CSV exports guard against spreadsheet formula injection.
- **Security headers.** `security-headers.inc` has a Content Security Policy and related headers for nginx. Use them, or the equivalent on your host.

The single-browser mode (opening `index.html` with no backend) keeps data in that browser's local storage, which anyone with access to the computer can read. It's meant for trying the app, not for real customer data.
