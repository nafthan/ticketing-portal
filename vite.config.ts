import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
// @ts-ignore: plain JavaScript helper shared with the build script
import { listStyles, applyStyle } from "./scripts/styles.mjs";

/**
 * Inlines the built script and stylesheet into index.html, so the build is a
 * single self-contained page that can be opened or hosted like the
 * single-file edition. Written here rather than pulled in as a dependency.
 */
function singleFile(): Plugin {
  return {
    name: "helpdesk-single-file",
    enforce: "post",
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find((f) => f.type === "asset" && f.fileName === "index.html");
      if (!html || html.type !== "asset") return;
      let page = String(html.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === "chunk" && file.isEntry) {
          const code = file.code.replace(/<\/script/gi, "<\\/script");
          page = page.replace(new RegExp(`<script[^>]*src="[^"]*${escape(name)}"[^>]*></script>`), () => `<script type="module">${code}</script>`);
          delete bundle[name];
        } else if (file.type === "asset" && name.endsWith(".css")) {
          const css = String(file.source).replace(/<\/style/gi, "<\\/style");
          page = page.replace(new RegExp(`<link[^>]*href="[^"]*${escape(name)}"[^>]*>`), () => `<style>${css}</style>`);
          delete bundle[name];
        }
      }
      html.source = page;
    },
  };
}
/**
 * `npx vite --mode <style>` previews a style pack from styles/ while developing.
 * (Builds make every style's copy after the default build: see scripts/styles.mjs.)
 */
function stylePreview(style: string): Plugin {
  return {
    name: "helpdesk-style-preview",
    apply: "serve",
    transformIndexHtml(html) {
      const pack = listStyles().find((s: { name: string }) => s.name === style);
      return pack ? applyStyle(html, pack) : html;
    },
  };
}
/** In the no-sample-data build, the sample data file is replaced with nothing. */
function noSampleData(): Plugin {
  const empty = "\0helpdesk-no-sample-data";
  return {
    name: "helpdesk-no-sample-data",
    enforce: "pre",
    resolveId(source) { return /(^|\/)demo-data\.json$/.test(source) ? empty : null; },
    load(id) { return id === empty ? "export default null;" : null; },
  };
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Modes: `clean` builds the no-sample-data copy (`vite build --mode clean`), a
 * style name previews that style, and `<style>-clean` does both while developing.
 */
export default defineConfig(({ mode }) => {
  const clean = /(^|-)clean$/.test(mode);
  const style = mode.replace(/-?clean$/, "");
  return {
    base: "./",
    define: { __HELPDESK_SAMPLE__: JSON.stringify(!clean) },
    plugins: [react(), singleFile(), stylePreview(style), ...(clean ? [noSampleData()] : [])],
    build: {
      target: "es2022",
      cssCodeSplit: false,
      assetsInlineLimit: 100_000_000,
      modulePreload: false,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  };
});
