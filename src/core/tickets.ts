/* Tickets: ids, creating, changing, resolving, assigning, shifts and the background sweep. */
import { S, ref, commit, toast, openDialog, closeDialog } from "./state.ts";
import { ACTIVE } from "./constants.ts";
import { parseMin, shortDate, fmtHrs, plural } from "./format.ts";
import { enqueue, withRetry, applyLocal, writeFailed, actor, putDoc, logEvent } from "./data.ts";
import { staffOf, staffName, staffSorted, isMgr, canRequest, permBlock, assignBlock, canTake, shiftKey, shiftOf, custOf, whoText } from "./people.ts";
import { routePick, routeEvents, routeWaiting, routeTicket } from "./routing.ts";
import { mkEmail } from "./emails.ts";
import { openRequest } from "./requests.ts";
import type { Customer, Ticket } from "./types.ts";

/* ---------- ids ---------- */
/** A random id like HD-7K2QM, using the workspace prefix. */
export function genId(): string {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let id: string;
  do { id = (S.cfg.idPrefix || "HD") + "-"; for (let i = 0; i < 5; i++) id += a[Math.floor(Math.random() * a.length)]; } while (S.byId.has(id));
  return id;
}
/** The next number for a customer with its own prefix (FAI1, FAI2…). */
export function nextIdNum(c: Customer | null | undefined): number {
  const pre = c && c.idPrefix; if (!pre) return 1; const re = new RegExp("^" + pre + "(\\d+)$"); let m = 0;
  for (const t of S.tickets) { const x = re.exec(t.id); if (x) m = Math.max(m, +x[1]); }
  const k = S.counters[pre]; return Math.max(+(c as Customer).idStart! || 1, m + 1, (k && +k.next) || 0);
}
export function maxIdNum(pre: string): number { const re = new RegExp("^" + pre + "(\\d+)$"); let m = 0; for (const t of S.tickets) { const x = re.exec(t.id); if (x) m = Math.max(m, +x[1]); } return m; }
/** Pick the id for a new ticket for this customer, reserving the number on the backend. */
export async function allocId(cid: string | null | undefined): Promise<string> {
  const c = cid ? S.custById.get(cid) : null, pre = c && c.idPrefix;
  if (!pre) return genId();
  let cref: any = null;
  if (ref.db) {
    cref = ref.db.collection("counters").doc(pre);
    if (typeof cref.acquire === "function") for (let i = 0; i < 10; i++) { try { const l = await cref.acquire({ holder: S.meId || "page", ttlMs: 6000 }); if (l.acquired) break; } catch (e) { break; } await new Promise((r) => setTimeout(r, 350)); }
  }
  let n = nextIdNum(c);
  if (cref) { try { const sn = await cref.get(); if (sn.exists) { const v = +sn.data().next; if (v > n) n = v; } } catch (e) { /* use local count */ } }
  for (let i = 0; i < 500; i++, n++) {
    const id = pre + n; if (S.byId.has(id)) continue;
    if (ref.db) { try { const sn = await ref.col.doc(id).get(); if (sn.exists) continue; } catch (e) { /* assume free */ } }
    if (cref) { try { await cref.set({ next: n + 1, at: new Date().toISOString() }); } catch (e) { /* best effort */ } } else S.counters[pre] = { next: n + 1 };
    return id;
  }
  return genId();
}

/* ---------- creating and changing ---------- */
export interface NewTicket {
  subject: string; description: string; customer: string; customerId?: string | null; contactId?: string | null;
  requesterName: string; requesterEmail: string; requesterPhone?: string; channel?: string | null; siteId?: string | null; site?: string;
  team: string; category: string; severity: string;
}
/** Create a ticket (auto-assigning it when routing is on). Resolves to the new id. */
export async function createTicket(f: NewTicket): Promise<string> {
  const id = await allocId(f.customerId), now = new Date().toISOString();
  const body: any = {
    subject: f.subject, description: f.description, customer: f.customer, customerId: f.customerId || null, contactId: f.contactId || null,
    requesterName: f.requesterName, requesterEmail: f.requesterEmail, requesterPhone: f.requesterPhone || "", channel: f.channel || null, siteId: f.siteId || null, site: f.site || "",
    team: f.team, category: f.category, severity: f.severity, status: "new", assigneeId: null, assigneeLabel: null,
    createdAt: now, updatedAt: now, resolvedAt: null, createdBy: S.meId, notes: [], timeline: [], incident: false,
    history: [Object.assign({ at: now, type: "created" }, actor())],
  };
  if (S.cfg.routing && S.cfg.routing.on) {
    const who = routePick(body);
    if (who) { body.assigneeId = who.uid || null; body.assigneeLabel = who.uid ? null : who.label; body.history = body.history.concat(routeEvents(body, who, now).map((e) => Object.assign({}, e, actor(), { at: now }))); body.status = "open"; }
  }
  const m = mkEmail(Object.assign({ id }, body), "opened"); if (m) body.emails = [m];
  return enqueue(id, async () => { if (ref.db) await withRetry(() => ref.col.doc(id).set(body)); applyLocal(id, body); return id; });
}
/**
 * Change a ticket. `build(t, now)` returns {changes, events} or null for no change.
 * Events get the time and who made them, and are appended to the history.
 */
export function patchTicket(id: string, build: (t: Ticket, now: string) => { changes: any; events?: any[] } | null | undefined): Promise<boolean> {
  return enqueue(id, async () => {
    const t = S.byId.get(id); if (!t) return false;
    const now = new Date().toISOString();
    const r = build(t, now); if (!r) return false;
    const evs = (r.events || []).map((e) => Object.assign({ at: now }, actor(), e));
    const body = Object.assign({}, r.changes, { updatedAt: now, history: (t.history || []).concat(evs) });
    if (ref.db) await withRetry(() => ref.col.doc(id).update(body));
    applyLocal(id, body); return true;
  }).catch((e) => { writeFailed(e); return false; });
}
/** Set one field. Closing goes through "closing" first when there's a grace period, unless forced. */
export function setField(id: string, field: string, value: any, force?: boolean): Promise<boolean> {
  let did: string | null = null;
  return patchTicket(id, (t, now) => {
    let v = value;
    if (field === "status" && v === "closed" && !force && S.cfg.rules.graceDays > 0 && t.status !== "closing") v = "closing";
    if (t[field] === v) return null;
    const ch: any = { [field]: v }, ev = [{ type: field, from: t[field], to: v }];
    if (field === "status") {
      if ((v === "resolved" || v === "closing" || v === "closed") && !t.resolvedAt) ch.resolvedAt = now;
      if (ACTIVE.has(v) && t.resolvedAt) ch.resolvedAt = null;
      ch.closingUntil = v === "closing" ? new Date(Date.now() + S.cfg.rules.graceDays * 864e5).toISOString() : null;
      const kind = ({ resolved: "resolved", closing: "closing", closed: "closed" } as Record<string, string>)[v], m = kind && mkEmail(Object.assign({}, t, ch), kind);
      if (m) ch.emails = (t.emails || []).concat([m]);
      did = v;
    }
    return { changes: ch, events: ev };
  }).then((ok) => {
    if (ok && did === "resolved") toast("Resolved. One less on the pile.", "party");
    if (ok && did === "closing") { const t = S.byId.get(id); if (t && t.closingUntil) toast("Closing. It can be reopened until " + shortDate(new Date(t.closingUntil).getTime()) + ".", "happy"); }
    return ok;
  });
}
export function reopenForCustomer(id: string): Promise<boolean> {
  return patchTicket(id, (t) => ACTIVE.has(t.status) ? null : { changes: { status: "open", resolvedAt: null, closingUntil: null }, events: [{ type: "status", from: t.status, to: "open", reason: "The customer asked to reopen it" }] })
    .then((ok) => { if (ok) toast("Reopened at the customer's request.", "happy"); return ok; });
}
/** Assign (uid or label) or unassign (neither). Agents get a request to a manager when they need one. */
export function assign(id: string, uid?: string | null, label?: string | null): Promise<boolean> {
  uid = uid || null; label = uid ? null : (label || null);
  const t0 = S.byId.get(id);
  if (t0) {
    if (canRequest() && permBlock(t0, uid, label)) { openRequest({ type: uid || label ? "assign" : "unassign", ticketId: id, to: uid, toLabel: label, from: t0.assigneeId || null, fromLabel: t0.assigneeLabel || null }); return Promise.resolve(false); }
    const why = assignBlock(t0, uid, label); if (why) { toast(why, "worried"); return Promise.resolve(false); }
  }
  return patchTicket(id, (t) => {
    if ((t.assigneeId || null) === uid && (t.assigneeLabel || null) === label) return null;
    const ch: any = { assigneeId: uid, assigneeLabel: label };
    const ev: any[] = [{ type: "assignee", from: t.assigneeId || null, fromLabel: t.assigneeLabel || null, to: uid, toLabel: label }];
    if ((uid || label) && t.status === "new") { ch.status = "open"; ev.push({ type: "status", from: "new", to: "open" }); }
    return { changes: ch, events: ev };
  }).then((ok) => { const m = (uid || label) && staffOf(uid, label); if (ok && m && m.avail === "leave") toast(staffName(m) + " is on leave, so this may wait until they're back.", "worried"); return ok; });
}
export function addNote(id: string, text: string, internal: boolean, minutes?: number, billable?: boolean): Promise<boolean> {
  return patchTicket(id, (t, now) => {
    const n: any = Object.assign({ at: now, text, internal: !!internal }, actor());
    const ev: any = { type: "note", internal: !!internal };
    if ((minutes as number) > 0) { n.minutes = minutes; n.billable = !!billable; ev.minutes = minutes; ev.billable = !!billable; ev.timeOnly = !text; }
    return { changes: { notes: (t.notes || []).concat([n]) }, events: [ev] };
  });
}
/** Add an incident timeline entry. `en.at` is an ISO time. */
export function addTimeline(id: string, en: { at: string; phase: string; text: string }): Promise<boolean> {
  return patchTicket(id, (t, now) => {
    const e = Object.assign({ id: "t" + Date.now().toString(36), at: en.at, phase: en.phase, text: en.text, loggedAt: now }, actor());
    return { changes: { incident: true, timeline: (t.timeline || []).concat([e]) }, events: [{ type: "timeline", phase: en.phase }] };
  });
}
export function startIncident(id: string): Promise<boolean> { return patchTicket(id, (t) => t.incident ? null : { changes: { incident: true }, events: [{ type: "timeline", started: true }] }); }

/* ---------- status ---------- */
/** Does moving to `to` need a resolution note or time first? */
export function needsResolve(t: Ticket, to: string): boolean {
  const R = S.cfg.rules;
  return (to === "resolved" || to === "closed") && ACTIVE.has(t.status) && (R.noteToResolve || (R.timeToResolve && !noteMins(t)[0]));
}
/** Change status. Opens the resolve dialog when a note or time is needed, or a request when an agent asks to reopen. */
export function changeStatus(id: string, to: string, force?: boolean): void {
  const t = S.byId.get(id); if (!t) return;
  if (t.status === "closed" && ACTIVE.has(to) && canRequest()) { openRequest({ type: "reopen", ticketId: id }); return; }
  if (t.status === "closing" && to === "closed") {
    if (ref.db && !isMgr()) { toast("This ticket closes for good on " + shortDate(new Date(t.closingUntil as string).getTime()) + ". A manager can close it sooner."); commit(); return; }
    force = true;
  }
  if (needsResolve(t, to)) { openDialog({ kind: "resolve", id: t.id, to: to as "resolved" | "closed" }); return; }
  setField(id, "status", to, force);
}
/**
 * Save the resolve dialog: the note and/or time, then the status.
 * `minutes` may be a number or the typed text ("1h 15m").
 * Returns an error message to show, "" when the save failed (a toast says why), or null once saved.
 */
export async function submitResolve(id: string, to: string, v: { text: string; internal: boolean; minutes: number | string; billable: boolean }): Promise<string | null> {
  const t = S.byId.get(id); if (!t) return "";
  const R = S.cfg.rules, tx = String(v.text || "").trim(), mins = typeof v.minutes === "number" ? v.minutes : parseMin(v.minutes);
  if (R.noteToResolve && !tx) return "Add a resolution note.";
  if (isNaN(mins) || mins > 10000) return "Enter the time like 30m, 1h 15m or 1:30.";
  if (R.timeToResolve && !noteMins(t)[0] && !mins) return "Log the time spent on this ticket.";
  const ok = (tx || mins) ? await addNote(t.id, tx ? "Resolution: " + tx : "", v.internal, mins, v.billable) : true;
  if (ok === false) return "";
  closeDialog(); setField(t.id, "status", to);
  return null;
}

/* ---------- taking tickets and shifts ---------- */
export function takeTicket(id: string): Promise<boolean> | void {
  if (!S.meId) return;
  if (canTake(S.meId)) return assign(id, S.meId);
  setShift(S.meId, null, true).then((ok) => { if (ok) assign(id, S.meId); });
}
export function myActive(): Ticket[] { return S.tickets.filter((t) => ACTIVE.has(t.status) && S.meId && t.assigneeId === S.meId); }
/** Clock out, or open the clock-out dialog when you still have active tickets. */
export function clockOut(): void {
  const mine = myActive();
  if (!mine.length) { setShift(S.meId, null, false).then((ok) => { if (ok) toast("Clocked out. See you next shift.", "sleepy"); }); return; }
  openDialog({ kind: "clockOut" });
}
/** Clock in ("clock-in" in the single-file edition). */
export function clockIn(): Promise<boolean> { return setShift(S.meId, null, true).then((ok) => { if (ok) toast("You're clocked in. Tickets can be assigned to you now.", "happy"); return ok; }); }
/** Clock-out dialog: keep your tickets. */
export function clockOutKeep(): Promise<boolean> { closeDialog(); return setShift(S.meId, null, false).then((ok) => { if (ok) toast("Clocked out. Your tickets stay with you.", "sleepy"); return ok; }); }
/** Clock-out dialog: return your tickets to Unassigned. */
export function clockOutReturn(): Promise<boolean> {
  closeDialog(); const mine = myActive();
  return Promise.all(mine.map((t) => assign(t.id, null))).then(() => setShift(S.meId, null, false)).then((ok) => { if (ok) toast("Clocked out. " + plural(mine.length, "ticket") + " returned to Unassigned.", "sleepy"); return ok; });
}
/** The "Auto-assign to …" button on a ticket. */
export function autoAssign(id: string): Promise<boolean> {
  return routeTicket(id).then((ok) => { const t = S.byId.get(id); if (ok && t) toast("Auto-assigned to " + whoText(t.assigneeId, t.assigneeLabel) + ".", "happy"); return ok; });
}
/** Clock someone in or out. `auto` is the automatic clock-out after the shift limit. */
export async function setShift(uid: string | null | undefined, label: string | null | undefined, on: boolean, auto?: boolean): Promise<boolean> {
  if (!uid && !label) return false;
  const k = shiftKey(uid, label), cur = shiftOf(uid, label);
  if (!!(cur && cur.on) === on) return true;
  const capped = auto && cur && cur.since ? new Date(new Date(cur.since).getTime() + S.cfg.rules.maxShiftHours * 36e5) : null;
  const at = capped && capped.getTime() < Date.now() ? capped : new Date(), now = at.toISOString();
  const mins = cur && cur.on && cur.since ? Math.max(0, Math.round((at.getTime() - new Date(cur.since).getTime()) / 6e4)) : null;
  try {
    await putDoc("shifts", k, on ? { on: true, since: now, uid: uid || null, label: uid ? null : label } : { on: false, since: null, lastIn: cur ? cur.since || null : null, lastOut: now, uid: uid || null, label: uid ? null : label });
    logEvent(Object.assign({ type: "shift", action: on ? "in" : "out", target: uid || null, targetLabel: uid ? null : label, minutes: mins }, auto ? { auto: true, at: now } : {}));
    if (auto && uid && uid === S.meId) toast("You were clocked out automatically after " + fmtHrs(S.cfg.rules.maxShiftHours) + ".", "sleepy");
    return true;
  } catch (e: any) { if (!auto) toast(e && e.code === "invalid_argument" ? "Only managers can change someone else's shift." : "That didn't save. Check your connection and try again.", "worried"); return false; }
}

/* ---------- background jobs ---------- */
const swept = new Set<string>(); let sweepT: any = null;
/** Run the background jobs soon (debounced). */
export function sweep(): void { clearTimeout(sweepT); sweepT = setTimeout(runSweep, 1500); }
/** Auto-assign waiting tickets, auto-close resolved ones, end grace periods and clock out forgotten shifts. */
export function runSweep(): void {
  routeWaiting();
  if (!ref.db || !S.canWrite) return;
  const now = Date.now(), R = S.cfg.rules;
  if (isMgr() && R.autoCloseDays > 0) for (const t of S.tickets)
    if (t.status === "resolved" && t.resolvedAt && now - new Date(t.resolvedAt).getTime() > R.autoCloseDays * 864e5 && !swept.has(t.id)) {
      swept.add(t.id);
      patchTicket(t.id, (x) => {
        if (x.status !== "resolved") return null; const g = S.cfg.rules.graceDays, to = g > 0 ? "closing" : "closed", ch: any = { status: to, closingUntil: g > 0 ? new Date(Date.now() + g * 864e5).toISOString() : null }, m = mkEmail(Object.assign({}, x, ch), to);
        if (m) ch.emails = (x.emails || []).concat([m]); return { changes: ch, events: [{ type: "status", from: "resolved", to, auto: true }] };
      });
    }
  for (const t of S.tickets)
    if (t.status === "closing" && t.closingUntil && new Date(t.closingUntil).getTime() <= now && (isMgr() || (S.meId && t.assigneeId === S.meId)) && !swept.has("g:" + t.id)) {
      swept.add("g:" + t.id);
      patchTicket(t.id, (x) => {
        if (x.status !== "closing") return null; const ch: any = { status: "closed", closingUntil: null }, m = mkEmail(Object.assign({}, x, ch), "closed"); if (m) ch.emails = (x.emails || []).concat([m]);
        return { changes: ch, events: [{ type: "status", from: "closing", to: "closed", auto: true, reason: "The grace period ended" }] };
      });
    }
  if (S.cfg.requireShift && R.maxShiftHours > 0) for (const x of S.shifts)
    if (x.on && x.since && now - new Date(x.since).getTime() > R.maxShiftHours * 36e5 && (isMgr() || (x.uid && x.uid === S.meId)) && !swept.has("s:" + x.id + x.since)) { swept.add("s:" + x.id + x.since); setShift(x.uid, x.label, false, true); }
}

/* ---------- small helpers ---------- */
/** [total minutes, billable minutes] logged on a ticket. */
export function noteMins(t: Ticket): [number, number] { let a = 0, b = 0; for (const n of t.notes || []) if ((n.minutes as number) > 0) { a += n.minutes as number; if (n.billable) b += n.minutes as number; } return [a, b]; }
/** The ticket's site: from the customer record, or the name typed on the ticket. */
export function siteOf(t: Partial<Ticket>): { id?: string; name: string; address?: string } | null {
  const c = custOf(t), st = c && t.siteId ? (c.sites || []).find((x) => x.id === t.siteId) : null;
  return st || (t.site ? { name: t.site, address: "" } : null);
}
/** Open a ticket in the side panel. */
export function openTicket(id: string): void { S.sel = id; commit(); }
/** Close the side panel (the customer one on Customers, the ticket one elsewhere). */
export function closePanel(): void { if (S.view === "customers") S.selCust = null; else S.sel = null; commit(); }
/** The "Move to…" choices for a ticket on Dispatch: [value, label], value "none", "u:<uid>" or "l:<label>". */
export function moveOptions(t: Ticket): [string, string][] {
  const cur = t.assigneeId ? "u:" + t.assigneeId : t.assigneeLabel ? "l:" + t.assigneeLabel : "none", out: [string, string][] = [];
  if (cur !== "none") out.push(["none", "Unassigned"]);
  const seen = new Set([cur]), add = (uid: string | null, label: string | null) => {
    const k = uid ? "u:" + uid : "l:" + label; if (seen.has(k)) return; seen.add(k);
    out.push([k, (uid ? (S.names[uid] || "Someone") : label) + (uid && uid === S.meId ? " (you)" : "") + (canTake(uid, label) ? "" : " (off shift)")]);
  };
  if (S.meId) add(S.meId, null);
  for (const m of staffSorted()) add(m.uid, m.label);
  for (const x of S.shifts) if (x.on && x.uid) add(x.uid, null);
  return out;
}
