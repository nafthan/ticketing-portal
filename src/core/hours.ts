/* Working hours, time zones and SLA clocks. */
import { S } from "./state.ts";
import { RUN } from "./constants.ts";
import { pad, dur, shortDate } from "./format.ts";
import { custOf } from "./people.ts";
import type { Ticket } from "./types.ts";

const dtfCache: Record<string, Intl.DateTimeFormat> = {};
const winCache = new Map<string, [number, number] | null>();
const slaCache = new Map<string, { k: string; r: any }>();

export interface TzParts { year: number; month: number; day: number; hour: number; minute: number; second: number }
/** The wall-clock parts of a moment in a time zone. */
export function tzParts(ms: number, tz: string): TzParts {
  let f = dtfCache[tz];
  if (!f) {
    const o: Intl.DateTimeFormatOptions = { hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" };
    try { f = new Intl.DateTimeFormat("en-GB", Object.assign({ timeZone: tz }, o)); } catch (e) { f = new Intl.DateTimeFormat("en-GB", o); } dtfCache[tz] = f;
  }
  const r: any = {}; for (const p of f.formatToParts(new Date(ms))) if (p.type !== "literal") r[p.type] = +p.value;
  if (r.hour === 24) r.hour = 0; return r;
}
export function tzOffset(ms: number, tz: string): number { const p = tzParts(ms, tz); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000; }
/** A wall-clock time in a time zone, as a UTC timestamp. */
export function wallToUtc(y: number, m: number, d: number, h: number, mi: number, tz: string): number { const g = Date.UTC(y, m - 1, d, h, mi); const t = g - tzOffset(g, tz); return g - tzOffset(t, tz); }
/** [start, end] of the working day on that date, or null for a day off or holiday. */
export function dayWindow(y: number, m: number, d: number): [number, number] | null {
  const key = S.cfgVer + "|" + y + "-" + m + "-" + d; if (winCache.has(key)) return winCache.get(key)!;
  const c = S.cfg, wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(), ds = y + "-" + pad(m) + "-" + pad(d); let w: [number, number] | null = null;
  if (c.days.includes(wd) && !c.holidays.includes(ds)) {
    const a = c.start.split(":").map(Number), b = c.end.split(":").map(Number);
    const st = wallToUtc(y, m, d, a[0], a[1], c.tz), en = wallToUtc(y, m, d, b[0], b[1], c.tz); if (en > st) w = [st, en];
  }
  winCache.set(key, w); return w;
}
/** Milliseconds of working time between a and b (all of it when `always`). */
export function workBetween(a: number, b: number, always?: boolean): number {
  if (b <= a) return 0; if (always) return b - a;
  const p = tzParts(a, S.cfg.tz), n = Math.min(1500, Math.ceil((b - a) / 864e5) + 2); let sum = 0;
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.UTC(p.year, p.month - 1, p.day + i)), w = dayWindow(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    if (!w) continue; if (w[0] >= b) break; sum += Math.max(0, Math.min(b, w[1]) - Math.max(a, w[0]));
  }
  return sum;
}
/** The moment `ms` of working time after `from`, or null when there are no working hours. */
export function addWork(from: number, ms: number, always?: boolean): number | null {
  if (always) return from + ms;
  const p = tzParts(from, S.cfg.tz);
  for (let i = 0; i < 1500; i++) {
    const dt = new Date(Date.UTC(p.year, p.month - 1, p.day + i)), w = dayWindow(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    if (!w) continue; const st = Math.max(from, w[0]); if (st >= w[1]) continue; const av = w[1] - st; if (ms <= av) return st + ms; ms -= av;
  }
  return null;
}
/** The resolution target for a ticket: the workspace default or the customer's own. */
export function target(t: Ticket): { hours: number; always: boolean; custom: boolean } {
  const c = custOf(t), b = S.cfg.targets[t.severity] || S.cfg.targets.S3, o = c && c.sla ? +(c.sla as any)[t.severity] : 0;
  return { hours: o > 0 ? o : b.hours, always: b.always || !!(c && c.allHours), custom: o > 0 };
}

export interface Sla {
  state: "met" | "missed" | "breached" | "paused" | "soon" | "ok";
  text: string; over: boolean; paused: boolean; key: number; due?: number | null;
  el: number; T: number; tg: { hours: number; always: boolean; custom: boolean };
}
/** Where a ticket stands against its target. The clock runs only while new or open. */
export function sla(t: Ticket): Sla {
  const now = Date.now(), c = custOf(t), key = t.updatedAt + "|" + S.cfgVer + "|" + (c ? c.id + c.updatedAt : "") + "|" + t.severity + "|" + t.status + "|" + Math.floor(now / 6e4);
  const hit = slaCache.get(t.id); if (hit && hit.k === key) return hit.r;
  const tg = target(t), T = tg.hours * 36e5, end = t.resolvedAt ? new Date(t.resolvedAt).getTime() : now;
  const ev = (t.history || []).filter((e) => e.type === "status").sort((x, y) => x.at < y.at ? -1 : x.at > y.at ? 1 : 0);
  let st = "new", from = new Date(t.createdAt).getTime(), el = 0;
  for (const e of ev) { const at = Math.min(new Date(e.at).getTime(), end); if (RUN.has(st)) el += workBetween(from, at, tg.always); st = e.to; from = Math.max(from, at); }
  if (!t.resolvedAt && RUN.has(t.status)) el += workBetween(from, now, tg.always);
  const over = el - T; let r: any;
  if (t.resolvedAt) r = { state: over <= 0 ? "met" : "missed", text: over <= 0 ? "Met" : "Missed by " + dur(over), over: false, paused: false, key: 9e15 };
  else {
    const paused = !RUN.has(t.status);
    if (over > 0) r = { state: "breached", over: true, paused, text: "Breached " + dur(over) + (paused ? ", paused" : ""), key: now - over };
    else if (paused) r = { state: "paused", over: false, paused: true, text: "Paused, " + dur(-over) + " left", key: 8e15 - over };
    else {
      const due = addWork(now, -over, tg.always), left = due == null ? Infinity : due - now;
      r = {
        state: left < S.cfg.rules.soonHours * 36e5 ? "soon" : "ok", over: false, paused: false, due, key: due == null ? 7e15 : due,
        text: due == null ? "No working hours set" : left < 864e5 ? dur(left) + " left" : "Due " + shortDate(due),
      };
    }
  }
  Object.assign(r, { el, T, tg });
  slaCache.set(t.id, { k: key, r }); return r;
}

/** Whether it's working time now, for the footer. */
export function workStatus(): { open: boolean; text: string } {
  const c = S.cfg, now = Date.now();
  try {
    const tf = new Intl.DateTimeFormat("en-GB", { timeZone: c.tz, hour: "2-digit", minute: "2-digit" }), wf = new Intl.DateTimeFormat("en-GB", { timeZone: c.tz, weekday: "long" });
    const tzn = (new Intl.DateTimeFormat("en-GB", { timeZone: c.tz, timeZoneName: "short" }).formatToParts(now).find((x) => x.type === "timeZoneName") || ({} as any)).value || c.tz;
    const p = tzParts(now, c.tz), ds = p.year + "-" + pad(p.month) + "-" + pad(p.day), w = dayWindow(p.year, p.month, p.day);
    if (w && now >= w[0] && now < w[1]) return { open: true, text: "Within working hours until " + tf.format(w[1]) + " " + tzn };
    for (let i = 0; i < 21; i++) {
      const dt = new Date(Date.UTC(p.year, p.month - 1, p.day + i)), x = dayWindow(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
      if (x && x[0] > now) return { open: false, text: (c.holidays.includes(ds) ? "Bank holiday. " : "Outside working hours. ") + "Opens " + (i === 0 ? "today" : i === 1 ? "tomorrow" : wf.format(x[0])) + " at " + tf.format(x[0]) + " " + tzn };
    }
  } catch (e) { /* bad time zone */ }
  return { open: false, text: "No working hours set" };
}
