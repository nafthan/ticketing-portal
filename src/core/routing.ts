/* Auto-assign: each category has an ordered list of agents; a ticket goes to the first one free. */
import { S, ref, toast } from "./state.ts";
import { ACTIVE } from "./constants.ts";
import { canTake, activeCount, staffByKey, staffName } from "./people.ts";
import { patchTicket } from "./tickets.ts";
import { saveCfg } from "./config.ts";
import type { Staff, Ticket } from "./types.ts";

/** The auto-assign order for a category: staff keys ("u:<uid>" / "l:<label>"). */
export function routeOrder(cat: string): string[] { return (S.cfg.routing && S.cfg.routing.cats[cat]) || []; }
/** ok | off | away | leave | full | gone. See ROUTE_LABEL. */
export function routeState(m: Staff | null | undefined): string {
  if (!m) return "gone"; if (m.avail === "leave") return "leave"; if (m.avail === "away") return "away";
  if (!canTake(m.uid, m.label)) return "off";
  const lim = S.cfg.rules.maxActive; if (lim && activeCount(m) >= lim) return "full";
  return "ok";
}
/** Staff keys of everyone who handed this ticket back (they're skipped). */
export function handedBack(t: Partial<Ticket>): Set<string> {
  const s = new Set<string>(); for (const e of t.history || []) if (e.type === "assignee" && (e.from || e.fromLabel) && !e.to && !e.toLabel) s.add(e.from ? "u:" + e.from : "l:" + e.fromLabel); return s;
}
/** Who this ticket would be auto-assigned to now, or null. */
export function routePick(t: Partial<Ticket>): Staff | null {
  const skip = handedBack(t);
  for (const k of routeOrder(t.category as string)) { if (skip.has(k)) continue; const m = staffByKey(k); if (m && routeState(m) === "ok") return m; }
  return null;
}
export function routeEvents(t: Partial<Ticket>, m: Staff, now: string): any[] {
  const ev: any[] = [{ at: now, type: "assignee", from: null, fromLabel: null, to: m.uid || null, toLabel: m.uid ? null : m.label, auto: true, reason: t.category + " auto-assign order" }];
  if (t.status === "new") ev.push({ at: now, type: "status", from: "new", to: "open", auto: true });
  return ev;
}
/** Auto-assign one unassigned active ticket. */
export function routeTicket(id: string): Promise<boolean> {
  return patchTicket(id, (t, now) => {
    if (t.assigneeId || t.assigneeLabel || !ACTIVE.has(t.status)) return null;
    const m = routePick(t); if (!m) return null;
    const evs = routeEvents(t, m, now).map((e) => { const x = Object.assign({}, e); delete x.at; return x; });
    return { changes: Object.assign({ assigneeId: m.uid || null, assigneeLabel: m.uid ? null : m.label }, t.status === "new" ? { status: "open" } : {}), events: evs };
  });
}
const routing = new Set<string>();
/** Auto-assign waiting tickets now that someone may be free (when retry is on). */
export async function routeWaiting(): Promise<void> {
  const R = S.cfg.routing; if (!R || !R.on || !R.retry || !S.canWrite) return;
  for (const t of S.tickets) {
    if (t.assigneeId || t.assigneeLabel || !ACTIVE.has(t.status) || !routeOrder(t.category).length) continue;
    const m = routePick(t); if (!m) continue;
    const key = t.id + "|" + t.updatedAt; if (routing.has(key)) continue; routing.add(key);
    try { if (ref.db) { const r = ref.col.doc(t.id); if (typeof r.acquire === "function") { const l = await r.acquire({ holder: S.meId || "page", ttlMs: 8000 }); if (!l.acquired) continue; } } } catch (e) { continue; }
    routeTicket(t.id).then((ok) => { if (ok && m.uid && m.uid === S.meId) toast(t.id + " was auto-assigned to you.", "happy"); });
  }
}
/** What happens to a new ticket in this category, for the new ticket form. tone: "ok" (someone found) or "wait". */
export function routeLine(cat: string): { text: string; tone: "ok" | "wait" } | null {
  const R = S.cfg.routing, ord = routeOrder(cat);
  if (!R || !R.on || !ord.length) return null;
  const m = routePick({ category: cat, history: [] });
  return m ? { text: "Will be auto-assigned to " + staffName(m) + ", first available for " + cat + ".", tone: "ok" }
    : { text: "Nobody in the " + cat + " order is available, so it will wait in Unassigned" + (R.retry ? " until someone is." : "."), tone: "wait" };
}
/** Save the auto-assign orders and/or the on/retry flags. */
export function saveRouting(cats?: Record<string, string[]> | null, flags?: { on?: boolean; retry?: boolean } | null): Promise<void> {
  return saveCfg({ routing: Object.assign({}, S.cfg.routing, flags || {}, { cats: cats || S.cfg.routing.cats }) });
}
/** Edit one category's order in place with fn(list), then save (editOrder in the single-file edition). */
export function editOrder(cat: string, fn: (l: string[]) => void): Promise<void> {
  const cats = JSON.parse(JSON.stringify(S.cfg.routing.cats)), l = (cats[cat] || []).slice(); fn(l); if (l.length) cats[cat] = l; else delete cats[cat]; return saveRouting(cats);
}
