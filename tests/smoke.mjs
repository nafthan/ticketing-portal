// Smoke test for both editions. Serves the repository, then for the built app
// (dist/index.html) and the single-file edition (single-file/index.html):
// opens it without a backend, then on the example adapter with two tabs.
// Then checks every style copy, every no-sample-data copy (dist/clean/ and
// single-file/clean/), and runs adapter-test.html against the example adapter.
//
//   npm run build
//   npm install --no-save playwright && npx playwright install chromium
//   npm run smoke
import { createServer } from "node:http";
import { readFile, access, readdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };

try { await access(join(root, "dist/index.html")); }
catch { console.error("dist/index.html is missing. Run `npm run build` first."); process.exit(1); }

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  if (path.includes("..")) { res.writeHead(400).end(); return; }
  try {
    const body = await readFile(join(root, path || "index.html"));
    res.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end("not found"); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;

let failed = 0;
const fail = (msg) => { failed++; console.error("FAIL " + msg); };
const pass = (msg) => console.log("ok   " + msg);
const adapter = join(root, "public/platform.example.js");

const browser = await chromium.launch();
try {
  for (const [name, page] of [["app", "/dist/index.html"], ["single-file", "/single-file/index.html"]]) {
    // 1. No backend: first-run setup, sample data, every tab.
    {
      const p = await browser.newPage(), errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base + page);
      const opened = await p.waitForSelector("#su[open]", { timeout: 8000 }).then(() => true, () => false);
      opened ? pass(`${name}: first-run setup opens`) : fail(`${name}: first-run setup didn't open`);
      if (opened && await p.locator("#su-sample").isVisible()) {
        await p.click("#su-sample");
        await p.waitForTimeout(700);
        const rows = await p.locator("#q-body tr").count();
        rows > 0 ? pass(`${name}: sample data loads (${rows} active tickets)`) : fail(`${name}: sample data didn't load`);
      }
      for (const v of ["mine", "dispatch", "history", "customers", "reports", "audit", "admin", "queue"]) {
        await p.click(`[data-v=${v}]`);
        await p.waitForTimeout(150);
      }
      errors.length ? fail(`${name}: page errors without a backend: ` + errors.join("; ")) : pass(`${name}: every tab renders without errors`);
      await p.close();
    }
    // 2. Example adapter: shared mode, live sync between tabs.
    {
      const ctx = await browser.newContext(), errors = [];
      await ctx.addInitScript({ path: adapter });
      const a = await ctx.newPage(), b = await ctx.newPage();
      for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.message));
      await a.goto(base + page);
      await a.waitForSelector("#su[open]", { timeout: 8000 });
      await a.click("[data-act=su-save]");
      await a.waitForTimeout(400);
      await b.goto(base + page + "?as=agent");
      await a.click("#btn-new");
      await a.selectOption("#f-cust", "__new");
      await a.fill("#f-customer", "Smoke Test Ltd");
      await a.fill("#f-subject", "Smoke test ticket");
      await a.click("[data-act=create]");
      await b.waitForFunction(() => document.querySelectorAll("#q-body tr").length > 0, null, { timeout: 8000 })
        .then(() => pass(`${name}: a new ticket appears live in a second tab`), () => fail(`${name}: the ticket didn't reach the second tab`));
      errors.length ? fail(`${name}: page errors on the example adapter: ` + errors.join("; ")) : pass(`${name}: runs on the example adapter without errors`);
      await ctx.close();
    }
  }
  // 3. Every style's copy of both editions: loads, sample data, every tab, no errors.
  const styles = (await readdir(join(root, "styles"), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const style of styles) {
    for (const [name, page] of [["app", `/dist/${style}/index.html`], ["single-file", `/single-file/${style}/index.html`]]) {
      const p = await browser.newPage(), errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      const res = await p.goto(base + page);
      if (!res || !res.ok()) { fail(`${style} ${name}: ${page} is missing`); await p.close(); continue; }
      const styled = await p.evaluate(() => document.documentElement.dataset.style);
      const opened = await p.waitForSelector("#su[open]", { timeout: 8000 }).then(() => true, () => false);
      if (opened && await p.locator("#su-sample").isVisible()) { await p.click("#su-sample"); await p.waitForTimeout(500); }
      const rows = await p.locator("#q-body tr").count();
      for (const v of ["mine", "dispatch", "history", "customers", "reports", "audit", "admin", "queue"]) { await p.click(`[data-v=${v}]`); await p.waitForTimeout(100); }
      const ok = styled === style && opened && rows > 0 && !errors.length;
      ok ? pass(`${style} ${name}: styled, sample data, every tab`) : fail(`${style} ${name}: style=${styled} setup=${opened} rows=${rows} errors=${errors.join("; ")}`);
      await p.close();
    }
  }
  // 4. Every no-sample-data copy: no sample data anywhere, setup works, every tab, no errors.
  for (const style of ["", ...styles]) {
    for (const [name, page] of [["app", `/dist/clean/${style ? style + "/" : ""}index.html`], ["single-file", `/single-file/clean/${style ? style + "/" : ""}index.html`]]) {
      const label = `no-sample ${style || "default"} ${name}`;
      const p = await browser.newPage(), errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      const res = await p.goto(base + page);
      if (!res || !res.ok()) { fail(`${label}: ${page} is missing`); await p.close(); continue; }
      const styled = (await p.evaluate(() => document.documentElement.dataset.style)) || "";
      const opened = await p.waitForSelector("#su[open]", { timeout: 8000 }).then(() => true, () => false);
      const setupLink = await p.locator("#su-sample").count();
      if (opened) { await p.click("[data-act=su-save]"); await p.waitForTimeout(300); }
      const loadLink = await p.locator("[data-act=load-demo]").count();
      for (const v of ["mine", "dispatch", "history", "customers", "reports", "audit", "admin"]) { await p.click(`[data-v=${v}]`); await p.waitForTimeout(100); }
      await p.click("[data-act=ad-tab][data-t=access]");
      await p.waitForTimeout(150);
      const adminCard = await p.locator(".adcard h3", { hasText: "Sample data" }).count();
      await p.click("[data-v=queue]");
      const rows = await p.locator("#q-body tr").count();
      const ok = styled === style && opened && !setupLink && !loadLink && !adminCard && rows === 0 && !errors.length;
      ok ? pass(`${label}: no sample data, setup, every tab`) : fail(`${label}: style=${styled} setup=${opened} setupLink=${setupLink} loadLink=${loadLink} adminCard=${adminCard} rows=${rows} errors=${errors.join("; ")}`);
      await p.close();
    }
  }
  // 5. Adapter checks, as manager and agent.
  for (const role of ["manager", "agent"]) {
    const p = await browser.newPage();
    await p.goto(`${base}/public/adapter-test.html?adapter=platform.example.js&as=${role}&run=1`);
    await p.waitForFunction(() => !document.getElementById("go").disabled && document.querySelectorAll(".t").length > 5, null, { timeout: 30000 });
    const bad = await p.locator(".t.fail").allInnerTexts();
    bad.length ? fail(`adapter checks as ${role}: ` + bad.join(" | ").replace(/\s+/g, " ")) : pass(`adapter checks pass as ${role}`);
    await p.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log("\nAll smoke checks passed");
