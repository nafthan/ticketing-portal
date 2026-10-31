/* The Queue view's filtering and sorting (S.q). */
import { S } from "./state.ts";
import { SEV, STATUSES, ACTIVE } from "./constants.ts";
import { sla } from "./hours.ts";
import { custName } from "./people.ts";
import type { Ticket } from "./types.ts";

/** Is any filter other than the status tab set? */
export function activeFilters(): boolean { const q = S.q; return !!(q.text || q.customer || q.sev || q.team || q.category || q.assignee || q.sla); }
/** Does a ticket pass every filter except the status tab? */
export function matchBase(t: Ticket): boolean {
  const q = S.q;
  if (q.customer && custName(t) !== q.customer) return false;
  if (q.sev === "hi") { if (t.severity !== "S1" && t.severity !== "S2") return false; } else if (q.sev && t.severity !== q.sev) return false;
  if (q.team && t.team !== q.team) return false;
  if (q.category && t.category !== q.category) return false;
  if (q.assignee === "me" && (!S.meId || t.assigneeId !== S.meId)) return false;
  if (q.assignee === "none" && (t.assigneeId || t.assigneeLabel)) return false;
  if (q.sla) { const s = sla(t).state; if (q.sla === "breached" && s !== "breached") return false; if (q.sla === "soon" && s !== "soon") return false; }
  if (q.text) {
    const n = q.text.toLowerCase();
    const hay = [t.id, t.subject, custName(t), t.requesterName, t.requesterEmail, t.category].join(" ").toLowerCase();
    if (!hay.includes(n)) return false;
  }
  return true;
}
/** Status tab: "all", "active" or a status. */
export function matchStatus(t: Ticket, s: string): boolean { return s === "all" || (s === "active" ? ACTIVE.has(t.status) : t.status === s); }
/** Sort by S.q.sort / S.q.dir (id, subject, sev, status, updatedAt, sla); ties newest-updated first. */
export function sortTickets(a: Ticket[]): Ticket[] {
  const { sort, dir } = S.q, m = dir === "asc" ? 1 : -1;
  const key = ({ id: (t: Ticket) => t.id, subject: (t: Ticket) => (t.subject || "").toLowerCase(), sev: (t: Ticket) => -(SEV[t.severity] || SEV.S3).level, status: (t: Ticket) => STATUSES.indexOf(t.status),
    updatedAt: (t: Ticket) => t.updatedAt || "", sla: (t: Ticket) => sla(t).key } as Record<string, (t: Ticket) => any>)[sort];
  return a.slice().sort((x, y) => { const p = key(x), q = key(y); return p < q ? -m : p > q ? m : (x.updatedAt < y.updatedAt ? 1 : -1); });
}
/** Tickets per day for the last `days` days (oldest first), by a date field such as createdAt or resolvedAt. */
export function perDay(field: string, days: number): number[] {
  const out = new Array(days).fill(0), start = new Date(); start.setHours(0, 0, 0, 0); const s0 = start.getTime() - (days - 1) * 864e5;
  for (const t of S.tickets) { if (!t[field]) continue; const i = Math.floor((new Date(t[field]).getTime() - s0) / 864e5); if (i >= 0 && i < days) out[i]++; }
  return out;
}
/** Customer names on loaded tickets, sorted. */
export function customers(): string[] { return [...new Set(S.tickets.map((t) => custName(t)).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
/** Clear every filter except the status tab and sort. */
export function resetFilters(): void { Object.assign(S.q, { text: "", customer: "", sev: "", team: "", category: "", assignee: "", sla: "" }); }
