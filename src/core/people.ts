/* Agents, customers, shifts and permissions. */
import { S, svc, ref, commit } from "./state.ts";
import { ACTIVE } from "./constants.ts";
import { plural } from "./format.ts";
import { staffId } from "./staff.ts";
import type { Customer, Shift, Staff, Ticket } from "./types.ts";

/** The uploaded photo id for an agent, if any. */
export function photoOf(uid: string | null | undefined, label?: string | null): string | null {
  if (!uid && !label) return null; const m = staffOf(uid, label);
  return m && typeof m.photoId === "string" && /^[0-9a-f]{32}$/.test(m.photoId) ? m.photoId : null;
}
/** A person's name as plain text. */
export function whoText(uid: string | null | undefined, label?: string | null, fallback?: string): string { return uid ? (S.names[uid] || "Unresolved user") : (label || fallback || "Unknown"); }
export function staffOf(uid: string | null | undefined, label?: string | null): Staff | null { return S.staff.find((x) => uid ? x.uid === uid : (!x.uid && x.label === label)) || null; }
export function mTeams(m: Staff | null | undefined): string[] { return m ? (Array.isArray(m.teams) ? m.teams : (m.team ? [m.team] : [])) : []; }
export function staffName(m: Staff): string { return m.uid ? (S.names[m.uid] || "Someone") : (m.label as string); }
export function staffSorted(): Staff[] { return S.staff.slice().sort((a, b) => staffName(a).localeCompare(staffName(b))); }
export function activeCount(m: Staff): number { return S.tickets.filter((t) => ACTIVE.has(t.status) && (m.uid ? t.assigneeId === m.uid : t.assigneeLabel === m.label)).length; }
export function custOf(t: Partial<Ticket>): Customer | null { return (t.customerId && S.custById.get(t.customerId)) || S.custByName.get(String(t.customer || "").toLowerCase()) || null; }
export function custName(t: Partial<Ticket>): string { const c = custOf(t); return c ? c.name : (t.customer || ""); }

/** Managers can do everything; without a backend, so can everyone. */
export function isMgr(): boolean { return ref.db ? S.isEditor : true; }
export function canEditCfg(): boolean { return isMgr(); }
/** Agents send requests to managers for changes they can't make themselves. */
export function canRequest(): boolean { return !!(ref.db && S.meId && S.canWrite && !isMgr()); }
/** Would this assignment need a manager's approval for an agent? */
export function permBlock(t: Ticket, uid: string | null, label: string | null): boolean {
  const mine = !!S.meId && t.assigneeId === S.meId, taken = !!(t.assigneeId || t.assigneeLabel);
  if (!uid && !label) return taken && !mine;
  if (!uid || uid !== S.meId) return true;
  return taken && !mine;
}

export function shiftKey(uid: string | null | undefined, label?: string | null): string { return uid || staffId(null, label); }
export function shiftOf(uid: string | null | undefined, label?: string | null): Shift | null { if (!uid && !label) return null; const k = shiftKey(uid, label); return S.shifts.find((x) => x.id === k) || null; }
export function onShift(uid: string | null | undefined, label?: string | null): boolean { const d = shiftOf(uid, label); return !!(d && d.on); }
export function canTake(uid: string | null | undefined, label?: string | null): boolean { return !S.cfg.requireShift || !ref.db || onShift(uid, label); }
/** Why this assignment isn't allowed, or null when it is. */
export function assignBlock(t: Ticket, uid: string | null, label: string | null): string | null {
  if (!S.canWrite) return "You have view-only access.";
  const mgr = isMgr(), mine = !!S.meId && t.assigneeId === S.meId, taken = !!(t.assigneeId || t.assigneeLabel);
  if (!uid && !label) return mgr || mine || !taken ? null : "Only a manager can unassign someone else's ticket.";
  if (!mgr) {
    if (!uid || uid !== S.meId) return "Only a manager can assign tickets to someone else.";
    if (taken && !mine) return "This ticket is already assigned. Ask a manager to reassign it.";
  }
  const lim = S.cfg.rules.maxActive;
  if (lim && !mgr) {
    const n = S.tickets.filter((x) => ACTIVE.has(x.status) && x.id !== t.id && x.assigneeId === uid).length;
    if (n >= lim) return "You already have " + plural(n, "active ticket") + ", the most allowed at once. Resolve or hand one back first.";
  }
  if (!canTake(uid, label)) return uid && uid === S.meId ? "Clock in to take tickets." : whoText(uid, label) + " isn't clocked in, so they can't be given tickets right now.";
  return null;
}
/** "u:<uid>" or "l:<label>" */
export function staffKey(m: Staff): string { return m.uid ? "u:" + m.uid : "l:" + m.label; }
export function staffByKey(k: string): Staff | null { return S.staff.find((m) => staffKey(m) === k) || null; }
/** Look up names and photos for these user ids. */
export function resolveNames(ids: string[]): void {
  if (!svc.user || !ids.length) return;
  svc.user.profiles(ids).then((ps: any) => { for (const id of ids) { const p = ps[id]; if (p) { S.names[id] = p.name || "Someone"; if (p.avatarUrl) S.avatars[id] = p.avatarUrl; } } commit(); }).catch(() => {});
}

const asked = new Set<string>(); let hydT: any = null;
/**
 * Look up names for user ids mentioned in tickets, history, notes, audit entries and requests that aren't known yet.
 * Stands in for hydrate() in the single-file edition, which looked up every id on screen. Debounced; each id is asked for once.
 */
export function hydrateNames(): void {
  if (!svc.user) return;
  clearTimeout(hydT);
  hydT = setTimeout(() => {
    const ids = new Set<string>(), add = (v: any) => { if (typeof v === "string" && v && !S.names[v] && !asked.has(v)) ids.add(v); };
    for (const t of S.byId.values()) {
      add(t.assigneeId); add(t.createdBy);
      for (const e of t.history || []) { add(e.by); if (e.type === "assignee") { add(e.from); add(e.to); } }
      for (const n of t.notes || []) add(n.by);
      for (const x of t.timeline || []) add(x.by);
      for (const m of t.emails || []) add(m.doneBy);
    }
    for (const e of S.events) { add(e.by); add(e.target); }
    for (const d of S.reqDocs) { add(d.id); for (const it of (Array.isArray(d.items) ? d.items : [])) { add(it && it.to); add(it && it.from); add(it && it.colUid); } }
    for (const k of Object.keys(S.decisions)) add(S.decisions[k] && S.decisions[k].by);
    for (const p of S.pins) add(p.by);
    if (S.cfg.announce) add(S.cfg.announce.by);
    const list = [...ids]; if (!list.length) return;
    list.forEach((id) => asked.add(id)); resolveNames(list);
  }, 300);
}
