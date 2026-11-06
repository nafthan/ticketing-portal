// Makes a copy of each edition for every style pack in styles/, with and
// without the sample data.
//
//   node scripts/styles.mjs app            dist/index.html        → dist/<style>/index.html
//                                          dist/clean/index.html  → dist/clean/<style>/index.html
//   node scripts/styles.mjs single         single-file/index.html → single-file/<style>/index.html,
//                                          single-file/clean/index.html and single-file/clean/<style>/index.html
//   node scripts/styles.mjs single --check fail if the single-file copies are out of date
//
// The clean copies have no sample data: the app's is built with `vite build --mode clean`,
// and the single-file edition's is made here by removing its sample data sections.
//
// A style pack is a folder with style.json (name, themes, fonts) and style.css
// (loaded after the shared stylesheet). See styles/README.md. Uses Node only,
// no packages, so it runs anywhere Node does.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Every style pack in styles/, sorted by name. */
export function listStyles(dir = join(root, "styles")) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "style.json")))
    .map((d) => {
      const meta = JSON.parse(readFileSync(join(dir, d.name, "style.json"), "utf8"));
      const css = existsSync(join(dir, d.name, "style.css")) ? readFileSync(join(dir, d.name, "style.css"), "utf8") : "";
      if (meta.name !== d.name) throw new Error(`styles/${d.name}/style.json: "name" must be "${d.name}"`);
      return { name: d.name, meta, css };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The page for one style: its fonts, its themes and its stylesheet added to the base page. */
export function applyStyle(html, { name, meta, css }) {
  const { label = name, skins = [], light, dark, mode = "system", fonts } = meta;
  if (!skins.length || !light || !dark) throw new Error(`styles/${name}/style.json needs "skins", "light" and "dark"`);
  const first = mode === "light" ? light : dark;
  let out = html;
  if (fonts) out = out.replace(/(<link href=")https:\/\/fonts\.googleapis\.com\/css2\?[^"]*(" rel="stylesheet">)/, (_m, a, b) => a + fonts.replace(/&/g, "&amp;") + b);
  out = out.replace(/<html([^>]*?)\sdata-skin="[^"]*"/, (_m, a) => `<html${a} data-style="${name}" data-skin="${first}"`);
  const config = JSON.stringify({ name, label, skins, light, dark, mode }).replace(/</g, "\\u003c");
  const block = `<meta name="helpdesk-style" content="${name}">\n<script>window.HELPDESK_STYLE=${config};</script>\n<style id="style-pack">\n${css.replace(/<\/style/gi, "<\\/style")}</style>\n`;
  const at = out.lastIndexOf("</head>");
  if (at < 0) throw new Error("No </head> in the page");
  return out.slice(0, at) + block + out.slice(at);
}

/** The single-file page without its sample data: the data block, loadDemo() and the setup link. */
export function stripSampleData(html) {
  const cuts = [
    [/<script type="application\/json" id="demo-data">[\s\S]*?<\/script>\n?/, "the sample data block"],
    [/\/\* -{10} standalone demo data -{10} \*\/[\s\S]*?\/\* -{10} end of demo data -{10} \*\/\n/, "loadDemo()"],
    [/<button class="linkbtn" data-act="su-sample"[^>]*>[^<]*<\/button>/, "the setup link"],
  ];
  let out = html;
  for (const [re, what] of cuts) {
    if (!re.test(out)) throw new Error(`single-file/index.html: couldn't find ${what} to remove`);
    out = out.replace(re, "");
  }
  return out;
}

const NOTE = (from) => `<!-- Generated from ${from} by scripts/styles.mjs. Don't edit: change those and run npm run styles. -->\n`;

function run(mode, check) {
  const styles = listStyles();
  if (mode === "app") {
    const made = [];
    for (const from of ["dist", "dist/clean"]) {
      if (!existsSync(join(root, from, "index.html"))) continue;
      const base = readFileSync(join(root, from, "index.html"), "utf8");
      for (const s of styles) {
        const dir = join(root, from, s.name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "index.html"), applyStyle(base, s));
        for (const f of ["adapter-test.html", "platform.example.js"]) if (existsSync(join(root, from, f))) copyFileSync(join(root, from, f), join(dir, f));
        made.push(`${from}/${s.name}/`);
      }
    }
    console.log(`Styled app copies: ${made.join(", ") || "none"}`);
    return 0;
  }
  if (mode === "single") {
    const base = readFileSync(join(root, "single-file/index.html"), "utf8");
    const clean = stripSampleData(base);
    const note = (page, from) => page.replace(/^<!doctype html>\n?/i, (m) => m + NOTE(from));
    const pages = [["single-file/clean/index.html", note(clean, "single-file/index.html")]];
    for (const s of styles) {
      pages.push([`single-file/${s.name}/index.html`, note(applyStyle(base, s), `single-file/index.html and styles/${s.name}/`)]);
      pages.push([`single-file/clean/${s.name}/index.html`, note(applyStyle(clean, s), `single-file/index.html and styles/${s.name}/`)]);
    }
    const stale = [];
    for (const [rel, page] of pages) {
      const file = join(root, rel);
      if (check) { if (!existsSync(file) || readFileSync(file, "utf8") !== page) stale.push(rel); continue; }
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, page);
    }
    if (check) {
      if (stale.length) { console.error("Out of date (run npm run styles):\n  " + stale.join("\n  ")); return 1; }
      console.log("Single-file copies are up to date.");
      return 0;
    }
    console.log(`Single-file copies: ${pages.map(([rel]) => rel.replace(/index\.html$/, "")).join(", ")}`);
    return 0;
  }
  console.error("Usage: node scripts/styles.mjs app|single [--check]");
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(run(process.argv[2], process.argv.includes("--check")));
