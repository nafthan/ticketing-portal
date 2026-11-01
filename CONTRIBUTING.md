# Contributing

Thanks for helping out.

## Ground rules

- **Keep the editions in step.** Features go in the app (`src/`) and the single-file edition (`single-file/index.html`), so both stay equal. If you can only do one, say so in the pull request and someone can help port it.
- **Keep dependencies minimal.** The app uses React to run and Vite and TypeScript to build, and nothing else. Please open an issue before adding a package; most needs can be met with a few lines of code. The single-file edition has no dependencies at all.
- **Styles are CSS only.** A style in `styles/` must work with the markup both editions share; check every style after changing markup or `src/styles.css`.
- **Logic in `src/core`, screens in components.** See [`ARCHITECTURE.md`](ARCHITECTURE.md). Core code has no React and is unit-tested.
- **Don't break the backend contract.** The app only reaches its backend through `window.helpdesk.use()`. If a change needs something new from the backend (a new collection, a new call), document it in `PLATFORM.md` in the same pull request.
- **Work without a backend.** Every feature should behave sensibly in the single-browser demo, even if that means it's hidden or read-only there.
- **Fictional sample data only.** Sample people, companies and addresses must be made up, with email addresses on `.example` domains.

## Making a change

1. Fork the repository and create a branch.
2. `npm install`, then `npm run dev` to work on the app with live reload. Check your change with and without sample data, in light and dark themes, and at phone width. Make the same change in `single-file/index.html`, then run `npm run styles` to remake its copies. Anything about sample data belongs behind `SAMPLE_DATA` in the app and `hasSampleData()` in the single-file edition, so the no-sample-data copies leave it out.
3. Run the checks, which GitHub Actions also runs on every pull request:
   ```
   npm run typecheck
   npm test
   npm run styles:check
   npm run build
   npm install --no-save playwright && npx playwright install chromium
   npm run smoke
   ```
4. If you changed what the app needs from its backend, update `PLATFORM.md`, `public/platform.example.js` and `public/adapter-test.html` to match.
5. Add a line to `CHANGELOG.md` under an "Unreleased" heading.
6. Open a pull request describing what changed and why. Screenshots help for anything visual.

## Reporting a security issue

Please don't open a public issue for security problems. See [`SECURITY.md`](SECURITY.md).
