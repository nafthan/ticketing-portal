/* Related and similar tickets: word overlap weighted by rarity (a small TF-IDF). */
import { S } from "./state.ts";
import { STOP } from "./constants.ts";
import { custOf } from "./people.ts";
import type { Ticket } from "./types.ts";

const tokCache = new Map<string, { k: string; v: Set<string> }>();
/** The distinct meaningful words in a text, roughly stemmed. */
export function toks(str: any): Set<string> {
  const out = new Set<string>();
  for (let w of String(str || "").toLowerCase().match(/[a-z0-9]+/g) || []) { if (w.length < 3 || STOP.has(w)) continue; if (w.length > 5) w = w.replace(/(ing|ed|es|s)$/, ""); out.add(w); }
  return out;
}
/** A ticket's words (subject, description, category), cached until it changes. */
export function tTok(t: Ticket): Set<string> {
  const k = t.updatedAt || ""; const c = tokCache.get(t.id); if (c && c.k === k) return c.v;
  const v = toks((t.subject || "") + " " + (t.description || "") + " " + (t.category || "")); tokCache.set(t.id, { k, v }); return v;
}
/** Tickets like this text, best first. Same customer and category score a little higher. */
export function similar(text: string, o?: { exclude?: string; customerId?: string | null; category?: string; limit?: number }): { t: Ticket; sc: number }[] {
  o = o || {}; const q = toks(text); if (q.size < 2) return [];
  const N = S.tickets.length || 1, df = new Map<string, number>();
  for (const t of S.tickets) for (const w of tTok(t)) if (q.has(w)) df.set(w, (df.get(w) || 0) + 1);
  const idf = (w: string) => Math.log(1 + N / (1 + (df.get(w) || 0))); let qn = 0; for (const w of q) qn += idf(w) ** 2;
  const out: { t: Ticket; sc: number }[] = [];
  for (const t of S.tickets) {
    if (t.id === o.exclude) continue; const tw = tTok(t); let sh = 0, n = 0; for (const w of q) if (tw.has(w)) { sh += idf(w) ** 2; n++; }
    if (n < 2) continue; let sc = sh / (qn || 1); const c = custOf(t); if (o.customerId && c && c.id === o.customerId) sc += .1; if (o.category && t.category === o.category) sc += .05;
    if (sc >= .22) out.push({ t, sc });
  }
  return out.sort((a, b) => b.sc - a.sc).slice(0, o.limit || 5);
}
