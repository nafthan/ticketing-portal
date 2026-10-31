/*
 * The app's single store.
 *
 * `S` holds everything the screens show; `P` holds the signed-in person's
 * preferences. Actions in src/core change them and then call `commit()`,
 * which tells React to re-render. Components read `S` and `P` directly while
 * rendering and never change them, except through actions.
 *
 * Nothing in src/core imports React or touches the DOM when it's loaded, so
 * the logic can be unit-tested with Node's built-in test runner.
 */
import type {
  Config, Customer, Decision, Dialog, AuditEvent, Pin, Prefs, Queue, RequestDoc, Shift, Staff, Ticket,
} from "./types.ts";

export type Mode = "connecting" | "shared" | "local" | "error";
export type View = "queue" | "mine" | "dispatch" | "history" | "customers" | "reports" | "audit" | "admin";
export const VIEWS: View[] = ["queue", "mine", "dispatch", "history", "customers", "reports", "audit", "admin"];
export const TICKET_VIEWS: View[] = ["queue", "mine", "dispatch", "history"];

/** Backend services, from window.helpdesk.use(). Loosely typed: see PLATFORM.md. */
export interface Services { db: any; user: any; assets: any; downloads: any }

export interface Toast { msg: string; mood: string; at: number }

export const S = {
  /* where you are */
  view: "queue" as View,
  sel: null as string | null,          // open ticket id
  selCust: null as string | null,      // open customer id
  dialog: null as Dialog | null,       // the one open dialog, rendered by <Dialogs/>
  toast: null as Toast | null,

  /* who you are */
  mode: "connecting" as Mode,
  meId: null as string | null,
  meName: "",
  meAvatar: "",
  isOwner: false,
  isEditor: false,                     // manager
  canWrite: true,                      // agent or manager
  names: {} as Record<string, string>,
  avatars: {} as Record<string, string>,

  /* data */
  loaded: false,
  tickets: [] as Ticket[],
  byId: new Map<string, Ticket>(),
  arch: new Map<string, Ticket>(),     // older closed tickets loaded on demand in History
  archMore: true,
  archBusy: false,
  customers: [] as Customer[],
  custById: new Map<string, Customer>(),
  custByName: new Map<string, Customer>(),
  staff: [] as Staff[],
  shifts: [] as Shift[],
  queues: [] as Queue[],
  reqDocs: [] as RequestDoc[],
  decisions: {} as Record<string, Decision>,
  events: [] as AuditEvent[],
  pins: [] as Pin[],
  counters: {} as Record<string, { next: number }>,
  cfg: null as unknown as Config,      // always set by setCfg() at start-up
  cfgVer: 0,
  cfgExists: false,
  cfgKnown: false,

  /* connection */
  online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
  hb: true,

  /* filters and page state that outlive a single component */
  q: { text: "", status: "active", customer: "", sev: "", team: "", category: "", assignee: "", sla: "", sort: "sla", dir: "asc" },
  disp: { team: "" },
  rep: { range: 30, team: "" },
  aud: { text: "", type: "", range: 0, who: "", limit: 200 },
  hist: { text: "", customer: "", category: "", who: "", sev: "", range: 0, st: "closed", sort: "new", limit: 150 },
  cuText: "",
  adTab: "general",
  heroMood: "happy",
  confirmSample: false,
  bellRing: 0,                         // set to Date.now() by noticeChanges() when new requests arrive: ring the bell

};
export type State = typeof S;

/** Preferences. Defaults here; cleanPrefs() in prefs.ts validates stored values. */
export const P: Prefs = {
  mode: "system", lightTheme: "peach", darkTheme: "cocoa", board: "board", mineView: "list", histView: "list", histGroup: "month",
  density: "cosy", mascot: true, squeak: false, notifyDecisions: true, notifyNew: true, notifySound: false, avatars: true, exact: false,
  start: "queue", mine: false, team: "", noteInternal: true,
};

/** Backend services, set once at start-up by boot() in data.ts. */
export const svc: Services = { db: null, user: null, assets: null, downloads: null };
/** The tickets collection, or null when running without a backend. */
export const ref: { db: any; col: any } = { db: null, col: null };

/* ---------- re-rendering ---------- */
let version = 0;
let queued = false;
const listeners = new Set<() => void>();

/** Ask the screens to re-render. Cheap to call often: calls are batched. */
export function commit(): void {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; version++; listeners.forEach((l) => l()); });
}
export function subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function getVersion(): number { return version; }

/* ---------- small shared actions ---------- */
/** Show a toast with Ping. Moods: happy | worried | sleepy | party. */
export function toast(msg: string, mood = "happy"): void { S.toast = { msg, mood, at: Date.now() }; commit(); }
export function openDialog(d: Dialog): void { S.dialog = d; commit(); }
export function closeDialog(): void { S.dialog = null; commit(); }
export function setView(v: View): void { S.view = v; commit(); if (typeof window !== "undefined") window.scrollTo(0, 0); }
