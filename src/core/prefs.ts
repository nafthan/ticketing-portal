/* The signed-in person's preferences (P): validation, themes and saving. */
import { S, P, ref, commit, VIEWS } from "./state.ts";
import { LS_PREF, skinKind } from "./constants.ts";
import type { Prefs } from "./types.ts";

/** Keep only the valid preference values from a stored object. */
export function cleanPrefs(o: any): Partial<Prefs> {
  const r: any = {}; if (!o || typeof o !== "object") return r;
  if (["light", "dark", "system"].includes(o.mode)) r.mode = o.mode;
  if (skinKind(o.lightTheme) === "light") r.lightTheme = o.lightTheme;
  if (skinKind(o.darkTheme) === "dark") r.darkTheme = o.darkTheme;
  if (!r.mode && skinKind(o.theme)) {
    const k = skinKind(o.theme);
    if (k === "light" && !r.lightTheme) r.lightTheme = o.theme; if (k === "dark" && !r.darkTheme) r.darkTheme = o.theme;
    r.mode = o.theme === "peach" ? "system" : k;
  }
  if (o.density === "cosy" || o.density === "compact") r.density = o.density;
  ["mascot", "squeak", "avatars", "exact", "mine", "noteInternal", "notifyDecisions", "notifyNew", "notifySound"].forEach((k) => { if (typeof o[k] === "boolean") r[k] = o[k]; });
  if ((VIEWS as string[]).includes(o.start)) r.start = o.start;
  if (o.board === "board" || o.board === "list") r.board = o.board;
  ["mineView", "histView"].forEach((k) => { if (o[k] === "board" || o[k] === "list") r[k] = o[k]; });
  if (["month", "agent", "category", "customer"].includes(o.histGroup)) r.histGroup = o.histGroup;
  if (o.team === "" || S.cfg.teams.includes(o.team)) r.team = o.team;
  return r;
}

let darkMQ: any;
function mq(): any {
  if (darkMQ === undefined) darkMQ = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  return darkMQ;
}
/** Is the system (or the host page's data-theme) dark? */
export function systemDark(): boolean {
  if (typeof document === "undefined") return false;
  const h = document.documentElement.getAttribute("data-theme"); if (h === "dark" || h === "light") return h === "dark";
  const m = mq(); return !!(m && m.matches);
}
/** The skin in use now. */
export function effectiveSkin(): string { const dark = P.mode === "dark" || (P.mode === "system" && systemDark()); return dark ? P.darkTheme : P.lightTheme; }
/** Set data-skin and data-density on <html>. */
export function applyPrefs(): void {
  if (typeof document === "undefined") return;
  const r = document.documentElement, sk = effectiveSkin(); if (r.dataset.skin !== sk) r.dataset.skin = sk; r.dataset.density = P.density;
}
function onSystemTheme() { if (P.mode !== "system") return; applyPrefs(); commit(); }

let prefTimer: any;
/** Change one preference: applies it, keeps it in this browser and, when signed in, saves it to the person's account. */
export function setPref(k: string, v: any): void {
  if (P[k] === v) return; P[k] = v; applyPrefs();
  try { localStorage.setItem(LS_PREF, JSON.stringify(P)); } catch (e) { /* storage blocked */ }
  clearTimeout(prefTimer); prefTimer = setTimeout(async () => { if (ref.db && S.meId) { try { await ref.db.doc("data/users/" + S.meId + "/prefs").set(Object.assign({}, P)); } catch (e) { /* ignore */ } } }, 900);
  commit();
}

let inited = false;
/** Start-up: load P from this browser, follow system theme changes, apply. */
export function initPrefs(): void {
  if (inited) return; inited = true;
  try { Object.assign(P, cleanPrefs(JSON.parse(localStorage.getItem(LS_PREF) || "null"))); } catch (e) { /* none saved */ }
  const m = mq();
  if (m) { if (m.addEventListener) m.addEventListener("change", onSystemTheme); else if (m.addListener) m.addListener(onSystemTheme); }
  try { new MutationObserver(onSystemTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) { /* no DOM */ }
  applyPrefs();
}
