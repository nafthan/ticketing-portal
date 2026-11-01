# Styles

helpdesk ships in several styles. Each style is a complete copy of both editions with its own look and layout; the features are identical because every copy is made from the same code.

| Style | Look | App | Single-file |
|---|---|---|---|
| **default** | Warm and friendly: rounded cards, soft colours, five colour themes | `dist/index.html` | `single-file/index.html` |
| **sodium** | Night-shift control room: warm near-black, one sodium-yellow accent, ultra-light headings. Navigation docked at the bottom; every tab is a left rail (greeting, stats, filters) beside the work area; Dispatch runs as one lane per agent | `dist/sodium/index.html` | `single-file/sodium/index.html` |
| **phosphor** | Server-rack terminal: hairline borders, square corners, monospace labels, a single green status-light accent. A three-pane console: sidebar navigation, the list in the middle, the open ticket always docked on the right | `dist/phosphor/index.html` | `single-file/phosphor/index.html` |
| **dusk** | Calm evening workspace: frosted glass, pill buttons, a soft violet glow. A floating sidebar, a centred column with tickets as cards, and tickets opening as a floating sheet | `dist/dusk/index.html` | `single-file/dusk/index.html` |

Every style has a light and a dark theme, follows the Light / Dark / System setting, and keeps Ping (who takes on the style's colours).

## Using a style

- **Single-file:** open or host `single-file/<style>/index.html`. These copies are committed to the repository, so there's nothing to build.
- **App:** `npm run build` makes `dist/<style>/index.html` for every style, next to the default `dist/index.html`.
- **Without sample data:** every style also has a copy in `clean/`: `single-file/clean/<style>/index.html` and `dist/clean/<style>/index.html`.
- **While developing the app:** `npx vite --mode <style>` runs the development server in that style.

Copies of the same helpdesk in different styles share their data when they're hosted on the same site, so people can each use the style they prefer.

## How a style works

A style is a folder in `styles/` with two files:

- **`style.json`**: the style's name, its colour themes and fonts.
- **`style.css`**: loaded after the shared stylesheet (`src/styles.css`, the same as the single-file edition's), so it only needs to say what's different.

`scripts/styles.mjs` adds those to each edition to make the copies. It uses Node only, with no packages.

### style.json

```json
{
  "name": "sodium",
  "label": "Sodium",
  "description": "One line for people choosing a style.",
  "mode": "dark",
  "light": "sodium-light",
  "dark": "sodium",
  "skins": [
    ["sodium", "Sodium", "#1f1d01", "#ffe900", "dark"],
    ["sodium-light", "Sodium light", "#f6f4ea", "#9a8a00", "light"]
  ],
  "fonts": "https://fonts.googleapis.com/css2?family=…&display=swap"
}
```

| Field | Meaning |
|---|---|
| `name` | The folder name. Lowercase letters only. |
| `label` | Shown to people. |
| `mode` | The starting Light / Dark / System setting. |
| `light`, `dark` | Which of its themes to use in light and dark mode. |
| `skins` | Its colour themes: id, label, background swatch, accent swatch, `light` or `dark`. They appear under Settings → Appearance. |
| `fonts` | A Google Fonts stylesheet address replacing the default fonts. Fonts must be free to redistribute (for example under the SIL Open Font License). |

### style.css

- **Themes:** define the colour variables for each theme id, for example `:root[data-skin="sodium"] { --bg: …; --accent: …; }`. The variables are the ones at the top of `src/styles.css` (`--bg`, `--surface`, `--well`, `--line`, `--ink`, `--muted`, `--faint`, `--accent`, `--accent-ink`, `--warn`, `--amber`, `--good`, `--sun`, `--blush`, `--pop-line`, `--pop-shadow`, `--bar`, `--display`, `--sans`, `--mono`), plus Ping's (`--m-body`, `--m-screen`, `--m-glow`, `--m-cheek`, `--m-ink`, `--m-limb`).
- **Look and layout:** scope everything else to the style, for example `html[data-style="sodium"] .tile { … }`. Both editions render the same elements, classes and ids, so one stylesheet styles both.
- Keep it working at phone width, in light and dark, and with every tab, panel, menu and dialog.

### Adding a style

1. Copy a folder in `styles/` and rename it.
2. Edit `style.json` and `style.css`.
3. Run `npm run styles` to make the single-file copies, and `npm run build` for the app.
4. Commit the folder, `single-file/<name>/index.html` and `single-file/clean/<name>/index.html`.

The GitHub check fails if a single-file copy is out of date, so remember step 3 after changing either a style or `single-file/index.html`.

Styles take inspiration from published design references, but never copy another brand's name, logo, illustrations or paid fonts.
