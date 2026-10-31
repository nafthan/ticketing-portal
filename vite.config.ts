import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

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
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default defineConfig({
  base: "./",
  plugins: [react(), singleFile()],
  build: {
    target: "es2022",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
