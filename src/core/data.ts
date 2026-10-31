/*
 * The store's link to the backend ("store", "customers, team, settings:
 * storage", "connection" and "start" in the single-file edition).
 * boot() subscribes to everything and keeps S up to date; writes go through
 * putDoc/delDoc here and patchTicket in tickets.ts.
 */
import { S, P, svc, ref, commit, toast, type View } from "./state.ts";
import { LS_KEY, LS_PREF, LS_COL } from "./constants.ts";
import { setCfg } from "./config.ts";
import { initPrefs, cleanPrefs, applyPrefs } from "./prefs.ts";
import { resolveNames, hydrateNames } from "./people.ts";
import { sweep } from "./tickets.ts";
import { activeFilters } from "./queue.ts";
import { noticeChanges } from "./requests.ts";
import { maybeSetup } from "./setup.ts";
import type { Ticket } from "./types.ts";
import demo from "../demo-data.json" with { type: "json" };

/** commit(), plus the first-run check that the single-file edition ran on every refresh. */
function refresh(): void { commit(); maybeSetup(); }

/* ---------- tickets in memory ---------- */
const chains = new Map<string, Promise<any>>();
/** Run writes for one record one after another. */
export function enqueue<T>(id: string, fn: () => T | Promise<T>): Promise<T> {
  const p = (chains.get(id) || Promise.resolve()).then(fn, fn);
  chains.set(id, p.catch(() => {})); return p;
}
let deepDone = false;
/** Replace the ticket list (keeping older closed tickets loaded in History) and handle a #ticket=ID link once. */
export function index(list: Ticket[]): void {
  S.tickets = list; S.byId = new Map(list.map((t) => [t.id, t])); for (const [k, v] of S.arch) if (!S.byId.has(k)) S.byId.set(k, v); S.loaded = true;
  if (!deepDone && list.length) {
    deepDone = true;
    const m = typeof location !== "undefined" ? location.hash.match(/^#ticket=([A-Za-z0-9-]+)$/) : null;
    if (m && S.byId.has(m[1])) { S.view = "queue"; S.q.status = "all"; S.sel = m[1]; setTimeout(() => { commit(); }, 0); }
  }
}
/** Apply a ticket change (body null deletes) to S straight away. */
export function applyLocal(id: string, body: any): void {
  if (S.arch.has(id) && !S.tickets.some((x) => x.id === id)) { if (body === null) S.arch.delete(id); else S.arch.set(id, Object.assign({}, S.arch.get(id), body)); index(S.tickets); refresh(); return; }
  const t = S.byId.get(id);
  if (body === null) { index(S.tickets.filter((x) => x.id !== id)); }
  else if (t) { const n = Object.assign({}, t, body); index(S.tickets.map((x) => x.id === id ? n : x)); }
  else { index([Object.assign({ id }, body)].concat(S.tickets)); }
  if (!ref.db) saveLocal();
  refresh();
}
export function saveLocal(): void { try { localStorage.setItem(LS_KEY, JSON.stringify(S.tickets)); } catch (e) { /* storage blocked or full */ } }
export function loadLocal(): Ticket[] { try { const r = localStorage.getItem(LS_KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; } catch (e) { return []; } }
/** Run a backend call, retrying once if the backend is briefly unavailable. */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try { const r = await fn(); if (!S.hb) { S.hb = true; commit(); } return r; }
  catch (e: any) { if (e && e.code === "unavailable") { await new Promise((r) => setTimeout(r, 400 + Math.random() * 600)); return fn(); } throw e; }
}
/** Tell the person a write failed, and why. */
export function writeFailed(e: any): void {
  const c = e && e.code;
  if (c === "invalid_argument" || c === "revoked" || c === "not_granted") { S.canWrite = false; commit(); toast("You have view-only access, so that change wasn't saved.", "worried"); }
  else if (c === "quota_exceeded") toast("Storage for the helpdesk is full. Remove old tickets before adding more.", "worried");
  else if (c === "resource_exhausted") toast("Too many changes at once. Wait a moment and try again.", "worried");
  else toast("That change wasn't saved. Check your connection and try again.", "worried");
}
/** Who made a change, for history and audit entries. */
export function actor(): { by: string | null; byLabel?: string } { return S.meId ? { by: S.meId } : { by: null, byLabel: ref.db ? "Unidentified user" : "This device" }; }

/* ---------- other collections ---------- */
export function indexCust(): void { S.custById = new Map(S.customers.map((c) => [c.id, c])); S.custByName = new Map(S.customers.map((c) => [String(c.name || "").toLowerCase(), c])); }
export function loadCol(k: string): any { try { return JSON.parse(localStorage.getItem(LS_COL[k]) || "null"); } catch (e) { return null; } }
export function saveCol(k: string, v: any): void { try { localStorage.setItem(LS_COL[k], JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
/** Apply a change to one of the S collections (customers, staff, shifts, queues, pins, events). */
export function applyCol(k: string, id: string, body: any, merge?: boolean): void {
  const s: any = S, arr = s[k].slice(), i = arr.findIndex((x: any) => x.id === id);
  if (body === null) { if (i >= 0) arr.splice(i, 1); }
  else if (i >= 0) arr[i] = Object.assign({}, merge ? arr[i] : {}, body, { id });
  else arr.push(Object.assign({}, body, { id }));
  s[k] = arr; if (k === "customers") indexCust(); if (!ref.db) saveCol(k, arr);
}
/** Save a document (merge = update the given fields only) and apply it straight away. */
export async function putDoc(k: string, id: string, body: any, merge?: boolean): Promise<void> {
  if (ref.db) { const r = ref.db.collection(k).doc(id); await withRetry(() => merge ? r.update(body) : r.set(body)); }
  applyCol(k, id, body, merge); refresh();
}
export async function delDoc(k: string, id: string): Promise<void> { if (ref.db) await withRetry(() => ref.db.collection(k).doc(id).delete()); applyCol(k, id, null); refresh(); }
/** Add an audit entry. Fire and forget. */
export function logEvent(ev: any): void {
  const e = Object.assign({ at: new Date().toISOString() }, actor(), ev), id = "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  putDoc("events", id, e).catch(() => {});
}
/** A fresh id with a one-letter prefix, e.g. newId("s") for a site. */
export function newId(p: string): string { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

/* ---------- connection ---------- */
/** Check the backend is reachable; updates S.hb. */
export async function heartbeat(): Promise<void> {
  if (!ref.db || (typeof document !== "undefined" && document.hidden)) return;
  const was = S.hb;
  try { await Promise.race([ref.db.doc("config/settings").get(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000))]); S.hb = true; }
  catch (e) { S.hb = false; }
  if (was !== S.hb) { commit(); if (S.hb && S.online) toast("Back online.", "happy"); }
}

/* ---------- downloads ---------- */
/** Used when the backend doesn't provide downloads. */
export const BROWSER_DL = {
  browser: true,
  async save({ filename, data }: { filename: string; data: any }) {
    const b = data instanceof Blob ? data : new Blob([data], { type: /\.json$/.test(filename) ? "application/json" : /\.csv$/.test(filename) ? "text/csv" : "text/plain" });
    const u = URL.createObjectURL(b), a = document.createElement("a"); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); return { status: "saved" };
  },
};
/** Offer a file to the person. */
export async function save(name: string, data: any): Promise<void> {
  if (!svc.downloads) return;
  try { await svc.downloads.save({ filename: name, data }); }
  catch (e: any) { if (e && e.code === "rate_limited") toast("An export is already waiting for your answer."); else if (!e || e.code !== "declined") toast("Export isn't available in this view.", "worried"); }
}

/* ---------- sample data ---------- */
/** Load the sample data into this browser, with its dates moved to now. */
export function loadDemo(): void {
  const D: any = JSON.parse(JSON.stringify(demo)), off = Date.now() - new Date(D.base).getTime();
  const shift = (v: any): any => typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(v) ? new Date(new Date(v).getTime() + off).toISOString() : Array.isArray(v) ? v.map(shift) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shift(x)])) : v;
  const d = shift(D);
  S.customers = d.customers; indexCust(); saveCol("customers", S.customers);
  S.staff = d.staff; saveCol("staff", S.staff);
  index(d.tickets); saveLocal(); refresh(); toast("Sample data loaded. Remove it any time from Admin.", "party");
}
/** Delete every sample ticket, customer, agent and shift. */
export async function removeSamples(): Promise<void> {
  try {
    for (const id of S.tickets.filter((t) => t.sample).map((t) => t.id)) { if (ref.db) await withRetry(() => ref.col.doc(id).delete()); }
    index(S.tickets.filter((t) => !t.sample)); if (!ref.db) saveLocal();
    for (const c of S.customers.filter((c) => c.sample)) await delDoc("customers", c.id);
    for (const m of S.staff.filter((m) => m.sample)) await delDoc("staff", m.id);
    for (const x of S.shifts.filter((x) => !x.uid && /\(sample\)$/.test(x.label || ""))) await delDoc("shifts", x.id);
    if (S.sel && !S.byId.has(S.sel)) S.sel = null; if (S.selCust && !S.custById.has(S.selCust)) S.selCust = null;
    S.confirmSample = false; refresh(); toast("Sample data removed.", "happy");
  } catch (e) { writeFailed(e); }
}

/* ---------- start ---------- */
let booted = false;
/** Start-up: preferences, backend services, subscriptions and timers. Call once. */
export async function boot(): Promise<void> {
  if (booted) return; booted = true;
  initPrefs(); S.view = P.start as View;
  refresh();
  if (typeof window !== "undefined") {
    window.addEventListener("offline", () => { S.online = false; commit(); });
    window.addEventListener("online", () => { S.online = true; commit(); heartbeat(); });
    setInterval(heartbeat, 30000);
    setInterval(() => { if (!document.hidden) sweep(); }, 60000);
    /* The single-file edition re-rendered the header every 30s (shift time) and ticket views every 60s (relative times). */
    setInterval(() => { if (!document.hidden) commit(); }, 30000);
  }
  const use = (n: string): Promise<any> => {
    try { const h = typeof window !== "undefined" ? (window as any).helpdesk : null; return h && h.use ? Promise.resolve(h.use(n)) : Promise.resolve(null); }
    catch (e) { return Promise.resolve(null); }
  };
  use("downloads").then((d) => { svc.downloads = d || BROWSER_DL; refresh(); });
  use("assets").then((a) => { svc.assets = a; refresh(); });
  const [d, u] = await Promise.all([use("db"), use("user")]);
  if (u) {
    svc.user = u;
    try {
      const me = await u.me(); S.meId = me.id || null; S.meName = me.name || ""; S.meAvatar = me.avatarUrl || ""; S.isOwner = !!me.isOwner;
      if (me.id && me.name) S.names[me.id] = me.name; if (me.id && me.avatarUrl) S.avatars[me.id] = me.avatarUrl;
      const cw = await u.can("data.write"); if (cw === false) S.canWrite = false; S.isEditor = !!(await u.canEdit());
    } catch (e) { /* not signed in */ }
  }
  if (P.mine && S.meId) S.q.assignee = "me";
  if (!d) {
    S.mode = "local"; S.pins = loadCol("pins") || []; S.shifts = loadCol("shifts") || []; S.queues = loadCol("queues") || []; S.customers = loadCol("customers") || []; indexCust(); S.staff = loadCol("staff") || []; S.events = loadCol("events") || [];
    { const lc = loadCol("config"); S.cfgExists = !!lc; S.cfgKnown = true; setCfg(lc); }
    index(loadLocal()); refresh(); return;
  }
  const db = d; ref.db = db; svc.db = db; ref.col = db.collection("tickets"); S.mode = "shared"; refresh();
  if (S.meId) {
    db.doc("data/users/" + S.meId + "/prefs").get().then((s: any) => {
      if (!s.exists) return; Object.assign(P, cleanPrefs(s.data())); applyPrefs();
      try { localStorage.setItem(LS_PREF, JSON.stringify(P)); } catch (e) { /* storage blocked */ }
      if (P.mine && !activeFilters()) S.q.assignee = "me";
      refresh();
    }).catch(() => {});
  }
  const docs = (sn: any) => sn.docs.map((x: any) => Object.assign({}, x.data(), { id: x.id }));
  db.collection("customers").onSnapshot((sn: any) => { S.customers = docs(sn); indexCust(); if (S.selCust && !S.custById.has(S.selCust)) S.selCust = null; refresh(); }, () => {});
  db.collection("counters").onSnapshot((sn: any) => { const o: any = {}; for (const x of docs(sn)) o[x.id] = x; S.counters = o; }, () => {});
  db.collection("pins").onSnapshot((sn: any) => { S.pins = docs(sn); hydrateNames(); refresh(); }, () => {});
  db.collection("queues").onSnapshot((sn: any) => { S.queues = docs(sn); refresh(); }, () => {});
  db.collection("requests").onSnapshot((sn: any) => { S.reqDocs = docs(sn); noticeChanges(); hydrateNames(); refresh(); }, () => {});
  db.collection("decisions").onSnapshot((sn: any) => { const o: any = {}; for (const x of sn.docs) o[x.id] = x.data(); S.decisions = o; noticeChanges(); hydrateNames(); refresh(); }, () => {});
  db.collection("shifts").onSnapshot((sn: any) => { S.shifts = docs(sn); resolveNames(S.shifts.map((x) => x.uid).filter(Boolean) as string[]); refresh(); sweep(); }, () => {});
  db.collection("staff").onSnapshot((sn: any) => { S.staff = docs(sn); resolveNames(S.staff.map((m) => m.uid).filter(Boolean) as string[]); refresh(); }, () => {});
  db.collection("events").orderBy("at", "desc").limit(1000).onSnapshot((sn: any) => { S.events = docs(sn); hydrateNames(); refresh(); }, () => {});
  db.doc("config/settings").onSnapshot((sn: any) => { S.cfgExists = sn.exists; S.cfgKnown = true; setCfg(sn.exists ? sn.data() : null); hydrateNames(); refresh(); }, () => {});
  ref.col.orderBy("createdAt", "desc").limit(1000).onSnapshot((snap: any) => {
    index(snap.docs.map((x: any) => Object.assign({}, x.data(), { id: x.id })));
    if (S.sel && !S.byId.has(S.sel)) S.sel = null;
    hydrateNames(); refresh(); sweep();
  }, () => { S.mode = "error"; S.loaded = true; refresh(); toast("Lost the connection to shared tickets. Reload the page to reconnect.", "worried"); });
}
