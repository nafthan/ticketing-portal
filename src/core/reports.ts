/* Reports (S.rep). */
import { S } from "./state.ts";
import type { Ticket } from "./types.ts";

/** Tickets opened in the report's range (S.rep.range days; 0 = all), for its team. */
export function repSet(): Ticket[] {
  const r = S.rep.range, from = r ? Date.now() - r * 864e5 : 0;
  return S.tickets.filter((t) => new Date(t.createdAt).getTime() >= from && (!S.rep.team || t.team === S.rep.team));
}
/** Count tickets by a key. */
export function tally<K>(set: Ticket[], fn: (t: Ticket) => K): Map<K, number> { const m = new Map<K, number>(); for (const t of set) { const k = fn(t); m.set(k, (m.get(k) || 0) + 1); } return m; }
