/* Closed ticket history (S.hist). */
import { S, ref, commit, toast } from "./state.ts";
import { index } from "./data.ts";
import { custName, whoText, hydrateNames } from "./people.ts";
import { noteMins } from "./tickets.ts";
import type { Ticket } from "./types.ts";

/** When and by whom a ticket was closed. */
export function closeInfo(t: Ticket): { at: string; ms: number; by: string | null; byLabel: string | null; auto: boolean } {
  let e: any = null; for (const x of t.history || []) if (x.type === "status" && (x.to === "closed" || x.to === "closing") && (!e || x.at >= e.at)) e = x;
  const at = t.closedAt || (e && e.at) || t.resolvedAt || t.updatedAt;
  return { at, ms: new Date(at).getTime(), by: e ? e.by : null, byLabel: e ? e.byLabel : null, auto: !!(e && e.auto) };
}
/** "u:<uid>", "l:<label>" or "none". */
export function histKey(t: Ticket): string { return t.assigneeId ? "u:" + t.assigneeId : t.assigneeLabel ? "l:" + t.assigneeLabel : "none"; }
/** Does a ticket match the (lowercase) search, and where? `where`/`text` are set when it matched in the description, a note or the timeline. */
export function histHit(t: Ticket, q: string): { ok: boolean; where?: string; text?: string } {
  if (!q) return { ok: true };
  const base = [t.id, t.subject, custName(t), t.requesterName, t.requesterEmail, t.category, t.team, t.site, whoText(t.assigneeId, t.assigneeLabel, "")].join(" ").toLowerCase();
  if (base.includes(q)) return { ok: true };
  const d = (t.description || ""); if (d.toLowerCase().includes(q)) return { ok: true, where: "Description", text: d };
  for (const n of (t.notes || []).slice().reverse()) if ((n.text || "").toLowerCase().includes(q)) return { ok: true, where: n.internal ? "Internal note" : "Note", text: n.text };
  for (const x of t.timeline || []) if ((x.text || "").toLowerCase().includes(q)) return { ok: true, where: "Timeline", text: x.text };
  return { ok: false };
}
export interface HistRow { t: Ticket; c: ReturnType<typeof closeInfo>; h: ReturnType<typeof histHit>; took: number; mins: number }
/** Closed (and, with st "both", closing) tickets matching S.hist, sorted. Includes older ones loaded on demand. */
export function histRows(): HistRow[] {
  const H = S.hist, q = H.text.toLowerCase(), from = H.range ? Date.now() - H.range * 864e5 : 0, out: HistRow[] = [];
  for (const t of S.byId.values()) {
    if (!(t.status === "closed" || (H.st === "both" && t.status === "closing"))) continue;
    if (H.customer && custName(t) !== H.customer) continue;
    if (H.category && t.category !== H.category) continue;
    if (H.sev && t.severity !== H.sev) continue;
    if (H.who && (H.who === "me" ? t.assigneeId !== S.meId : histKey(t) !== H.who)) continue;
    const c = closeInfo(t); if (from && c.ms < from) continue;
    const h = histHit(t, q); if (!h.ok) continue;
    out.push({ t, c, h, took: c.ms - new Date(t.createdAt).getTime(), mins: noteMins(t)[0] });
  }
  const cmp = ({ new: (a: HistRow, b: HistRow) => b.c.ms - a.c.ms, old: (a: HistRow, b: HistRow) => a.c.ms - b.c.ms, long: (a: HistRow, b: HistRow) => b.took - a.took, time: (a: HistRow, b: HistRow) => b.mins - a.mins } as Record<string, (a: HistRow, b: HistRow) => number>)[H.sort] || ((a: HistRow, b: HistRow) => b.c.ms - a.c.ms);
  return out.sort(cmp);
}
/** Load the next 500 closed tickets older than anything loaded. */
export async function loadOlderClosed(): Promise<void> {
  if (!ref.db || S.archBusy) return; S.archBusy = true; commit();
  try {
    let oldest: string | null = null; for (const t of S.byId.values()) if (!oldest || t.createdAt < oldest) oldest = t.createdAt;
    const sn = await ref.col.where("status", "==", "closed").where("createdAt", "<", oldest).orderBy("createdAt", "desc").limit(500).get();
    for (const d of sn.docs) { const t = Object.assign({}, d.data(), { id: d.id }); if (!S.tickets.some((x) => x.id === t.id)) S.arch.set(t.id, t); }
    if (sn.docs.length < 500) S.archMore = false;
    index(S.tickets); hydrateNames(); toast(sn.docs.length ? "Loaded " + sn.docs.length + " older closed tickets." : "There are no older closed tickets.", "happy");
  } catch (e) { toast("Older tickets couldn't be loaded. Try again in a moment.", "worried"); }
  S.archBusy = false; commit();
}
