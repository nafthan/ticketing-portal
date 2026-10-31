/* Dispatch: one list per agent, in priority order unless a manager has set a custom order (S.queues). */
import { S, ref, toast } from "./state.ts";
import { SEV, ACTIVE } from "./constants.ts";
import { slug } from "./format.ts";
import { putDoc, delDoc, logEvent } from "./data.ts";
import { sla } from "./hours.ts";
import { staffOf, mTeams, isMgr, canRequest } from "./people.ts";
import { openRequest } from "./requests.ts";
import type { Queue, Staff, Ticket } from "./types.ts";

export function sanId(v: any): string { return String(v).replace(/[^A-Za-z0-9_.~:@+-]/g, "_"); }
/** The queue key for a list: "u-<uid>", "l-<slug>" or "none". */
export function qKey(uid: string | null | undefined, label?: string | null): string { return uid ? "u-" + sanId(uid) : label ? "l-" + slug(label) : "none"; }
export function tkKey(t: Ticket): string { return qKey(t.assigneeId, t.assigneeLabel); }
/** The custom order for a list, or null. */
export function queueOf(key: string): Queue | null { const q = S.queues.find((x) => x.id === key); return q && Array.isArray(q.order) && q.order.length ? q : null; }
/** Highest severity first, then the nearest SLA. */
export function prio(a: Ticket, b: Ticket): number { const d = (SEV[b.severity] || SEV.S3).level - (SEV[a.severity] || SEV.S3).level; return d || sla(a).key - sla(b).key; }
/** Order a list: the custom order, with tickets not in it slotted in by priority. */
export function orderCol(list: Ticket[], key: string): Ticket[] {
  const auto = list.slice().sort(prio), q = queueOf(key); if (!q) return auto;
  const idx = new Map<string, number>(q.order.map((id: string, i: number) => [id, i])), lvl = (t: Ticket) => (SEV[t.severity] || SEV.S3).level;
  const out = auto.filter((t) => idx.has(t.id)).sort((a, b) => idx.get(a.id)! - idx.get(b.id)!);
  for (const t of auto.filter((t) => !idx.has(t.id))) {
    let i = out.findIndex((x) => idx.has(x.id) ? lvl(x) < lvl(t) : prio(t, x) < 0); if (i < 0) i = out.length; out.splice(i, 0, t);
  }
  return out;
}
export function colTickets(key: string): Ticket[] { return orderCol(S.tickets.filter((t) => ACTIVE.has(t.status) && tkKey(t) === key), key); }
/** Whose list a key is. */
export function colOwner(key: string): { uid: string | null; label: string | null } {
  if (key === "none") return { uid: null, label: null };
  const t = S.tickets.find((x) => tkKey(x) === key); if (t) return { uid: t.assigneeId || null, label: t.assigneeId ? null : t.assigneeLabel };
  const m = S.staff.find((x) => qKey(x.uid, x.label) === key); if (m) return { uid: m.uid || null, label: m.uid ? null : m.label };
  return key.startsWith("u-") ? { uid: key.slice(2), label: null } : { uid: null, label: null };
}
/** The new order after moving `id` before `before` (or after `after`). Null when nothing moves. pos is 1-based. */
export function planMove(key: string, id: string, before?: string | null, after?: string | null): { order: string[]; pos: number } | null {
  const ids = colTickets(key).map((t) => t.id), from = ids.indexOf(id); if (from < 0) return null;
  ids.splice(from, 1); let i = before ? ids.indexOf(before) : -1;
  if (i < 0 && after) { const a = ids.indexOf(after); i = a < 0 ? -1 : a + 1; }
  if (i < 0) i = before ? ids.length : (after ? ids.length : 0);
  ids.splice(i, 0, id); return i === from ? null : { order: ids, pos: i + 1 };
}
/** Move a ticket within a list. Agents send a request; managers save it. */
export function moveInQueue(key: string, id: string, before?: string | null, after?: string | null): void {
  const plan = planMove(key, id, before, after); if (!plan) return;
  const own = colOwner(key);
  if (canRequest()) { openRequest({ type: "reorder", qkey: key, ticketId: id, before: before || null, after: after || null, pos: plan.pos, colUid: own.uid, colLabel: own.label }); return; }
  if (!S.canWrite || (ref.db && !isMgr())) return;
  saveQueue(key, plan.order, own, id + " to position " + plan.pos);
}
export async function saveQueue(key: string, order: string[], own: { uid: string | null; label: string | null }, detail: string): Promise<boolean> {
  try {
    await putDoc("queues", key, { order, by: S.meId || null, at: new Date().toISOString() });
    logEvent({ type: "queue", action: "reordered", target: own.uid, targetLabel: own.label, detail }); return true;
  } catch (e: any) { toast(e && e.code === "invalid_argument" ? "Only managers can change the order." : "That didn't save. Check your connection and try again.", "worried"); return false; }
}
/** Back to automatic order. */
export async function resetQueue(key: string): Promise<void> {
  const own = colOwner(key);
  try { await delDoc("queues", key); logEvent({ type: "queue", action: "reset", target: own.uid, targetLabel: own.label }); }
  catch (e: any) { toast(e && e.code === "invalid_argument" ? "Only managers can change the order." : "That didn't save. Check your connection and try again.", "worried"); }
}
export interface DispatchGroup { key: string; uid: string | null; label: string | null; list: Ticket[]; mem?: Staff | null; q: string }
/** The Dispatch columns: Unassigned, you, then everyone else by name, each list ordered. Filtered by S.disp.team. */
export function dispatchGroups(): DispatchGroup[] {
  const team = S.disp.team, act = S.tickets.filter((t) => ACTIVE.has(t.status) && (!team || t.team === team)), m = new Map<string, any>();
  m.set("none", { key: "none", uid: null, label: null, list: [] });
  const add = (uid: string | null, label: string | null) => { const k = uid ? "u:" + uid : "l:" + label; if (!m.has(k)) m.set(k, { key: k, uid: uid || null, label: uid ? null : label, list: [], mem: staffOf(uid, label) }); return m.get(k); };
  if (S.meId) add(S.meId, null);
  for (const x of S.staff) if (!team || !mTeams(x).length || mTeams(x).includes(team)) add(x.uid, x.label);
  for (const x of S.shifts) if (x.on && x.uid) add(x.uid, null);
  for (const t of act) { if (!t.assigneeId && !t.assigneeLabel) m.get("none").list.push(t); else add(t.assigneeId, t.assigneeLabel).list.push(t); }
  const g: DispatchGroup[] = [...m.values()]; g.forEach((x) => { x.q = qKey(x.uid, x.label); x.list = orderCol(x.list, x.q); });
  const nm = (x: DispatchGroup) => (x.uid ? (S.names[x.uid] || "~" + x.uid) : x.label || "").toLowerCase(), rank = (x: DispatchGroup) => x.key === "none" ? 0 : x.uid && x.uid === S.meId ? 1 : 2;
  return g.sort((a, b) => rank(a) - rank(b) || (nm(a) < nm(b) ? -1 : 1));
}
