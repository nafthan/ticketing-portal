/* Workspace settings (config/settings): defaults, validation and saving. */
import { S, ref, commit, toast } from "./state.ts";
import { SEV, CHANNELS, TEAMS, CATEGORIES, DAYS, EM_EVENTS } from "./constants.ts";
import { whoText } from "./people.ts";
import { withRetry, saveCol, logEvent } from "./data.ts";
import type { Config } from "./types.ts";

/* No shareUrl here, as in the single-file edition: normCfg() adds it. */
export const DEF_CFG: Config = {
  routing: { on: true, retry: true, cats: {} }, name: "helpdesk", idPrefix: "HD", defaults: { severity: "S3", channel: "phone", team: "" }, announce: null,
  rules: { noteToResolve: false, timeToResolve: false, maxActive: 0, soonHours: 4, autoCloseDays: 0, maxShiftHours: 0, graceDays: 3 },
  email: {
    app: "outlook", templates: {
      opened: { on: true, subject: "[{ticket}] We've received your request: {subject}", body: "Hi {contact},\n\nThanks for getting in touch. We've logged your request as {ticket} and the team is on it.\n\nSubject: {subject}\nPriority: {severity}\n\nWe'll keep you updated. Just reply to this email if anything changes.\n\n{helpdesk}" },
      resolved: { on: true, subject: "[{ticket}] Resolved: {subject}", body: "Hi {contact},\n\nGood news: we've resolved {ticket}.\n\n{resolution}\n\nIf the problem comes back, reply to this email and we'll pick it straight back up.\n\n{helpdesk}" },
      closing: { on: true, subject: "[{ticket}] Closing soon: {subject}", body: "Hi {contact},\n\nWe're closing {ticket}. If you still need help with it, reply by {closingDate} and we'll reopen it. After that it will be closed for good, and anything new will need a new ticket.\n\n{helpdesk}" },
      closed: { on: false, subject: "[{ticket}] Closed: {subject}", body: "Hi {contact},\n\n{ticket} is now closed. Thanks for your patience, and get in touch any time you need us.\n\n{helpdesk}" },
    },
  },
  teams: TEAMS.slice(), categories: CATEGORIES.slice(), requireShift: true, tz: "Europe/London", days: [1, 2, 3, 4, 5], start: "08:00", end: "18:00",
  holidays: ["2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28", "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03", "2027-05-31", "2027-08-30", "2027-12-27", "2027-12-28"],
  targets: { S1: { hours: 4, always: true }, S2: { hours: 8, always: false }, S3: { hours: 16, always: false }, S4: { hours: 40, always: false } },
} as unknown as Config;

/** Validate stored settings, filling in a default for anything missing or wrong. */
export function normCfg(o: any): Config {
  const c = JSON.parse(JSON.stringify(DEF_CFG)); if (!o || typeof o !== "object") return c;
  if (typeof o.tz === "string" && o.tz) { try { new Intl.DateTimeFormat("en-GB", { timeZone: o.tz }); c.tz = o.tz; } catch (e) { /* keep default */ } }
  if (Array.isArray(o.days)) { const d = o.days.filter((x: any) => Number.isInteger(x) && x >= 0 && x < 7); if (d.length) c.days = [...new Set(d)].sort(); }
  const tm = /^([01]\d|2[0-3]):[0-5]\d$/; if (tm.test(o.start) && tm.test(o.end) && o.start < o.end) { c.start = o.start; c.end = o.end; }
  if (Array.isArray(o.holidays)) c.holidays = o.holidays.filter((x: any) => /^\d{4}-\d\d-\d\d$/.test(x)).sort();
  if (o.targets && typeof o.targets === "object") for (const k of Object.keys(SEV)) { const t = o.targets[k]; if (t && +t.hours > 0) c.targets[k] = { hours: +t.hours, always: !!t.always }; }
  const list = (a: any, max: number) => Array.isArray(a) ? [...new Set(a.map((x: any) => String(x == null ? "" : x).trim().slice(0, 60)).filter(Boolean))].slice(0, max) : null;
  const tl = list(o.teams, 40); if (tl && tl.length) c.teams = tl; const ct = list(o.categories, 80); if (ct && ct.length) c.categories = ct;
  if (typeof o.requireShift === "boolean") c.requireShift = o.requireShift;
  {
    const ro = o.routing && typeof o.routing === "object" ? o.routing : {}, cats: Record<string, string[]> = {};
    if (ro.cats && typeof ro.cats === "object") for (const k of Object.keys(ro.cats).slice(0, 120)) {
      const v = ro.cats[k];
      if (Array.isArray(v)) { const l = [...new Set(v.filter((x: any) => typeof x === "string" && /^(u|l):.{1,120}$/.test(x)))].slice(0, 30) as string[]; if (l.length) cats[String(k).slice(0, 60)] = l; }
    }
    c.routing = { on: typeof ro.on === "boolean" ? ro.on : true, retry: typeof ro.retry === "boolean" ? ro.retry : true, cats };
  }
  if (typeof o.name === "string" && o.name.trim()) c.name = o.name.trim().slice(0, 40);
  c.shareUrl = typeof o.shareUrl === "string" && /^https:\/\/\S+$/.test(o.shareUrl) ? o.shareUrl.slice(0, 500) : "";
  if (typeof o.idPrefix === "string" && /^[A-Za-z0-9]{1,6}$/.test(o.idPrefix)) c.idPrefix = o.idPrefix.toUpperCase();
  const df = o.defaults && typeof o.defaults === "object" ? o.defaults : {};
  c.defaults = { severity: SEV[df.severity] ? df.severity : "S3", channel: CHANNELS[df.channel] ? df.channel : "phone", team: typeof df.team === "string" ? df.team : "" };
  const r = o.rules && typeof o.rules === "object" ? o.rules : {}, num = (v: any, lo: number, hi: number, d: number) => { v = Number(v); return Number.isFinite(v) && v >= lo && v <= hi ? v : d; };
  c.rules = { noteToResolve: !!r.noteToResolve, timeToResolve: !!r.timeToResolve, maxActive: Math.round(num(r.maxActive, 0, 200, 0)), soonHours: num(r.soonHours, .5, 72, 4), autoCloseDays: num(r.autoCloseDays, 0, 365, 0), maxShiftHours: num(r.maxShiftHours, 0, 24, 0), graceDays: num(r.graceDays, 0, 30, 3) };
  const em = o.email && typeof o.email === "object" ? o.email : {}, tp = em.templates && typeof em.templates === "object" ? em.templates : {};
  c.email = { app: em.app === "mailto" ? "mailto" : "outlook", templates: {} };
  for (const k of Object.keys(DEF_CFG.email.templates)) {
    const d = DEF_CFG.email.templates[k], x = tp[k] && typeof tp[k] === "object" ? tp[k] : {};
    c.email.templates[k] = { on: typeof x.on === "boolean" ? x.on : d.on, subject: typeof x.subject === "string" && x.subject.trim() ? x.subject.slice(0, 200) : d.subject, body: typeof x.body === "string" && x.body.trim() ? x.body.slice(0, 4000) : d.body };
  }
  const an = o.announce;
  c.announce = an && typeof an === "object" && typeof an.text === "string" && an.text.trim() ? {
    text: an.text.trim().slice(0, 500), tone: ["info", "warning", "critical"].includes(an.tone) ? an.tone : "info",
    until: typeof an.until === "string" ? an.until : null, at: typeof an.at === "string" ? an.at : null, by: typeof an.by === "string" ? an.by : null, byLabel: typeof an.byLabel === "string" ? an.byLabel : null,
  } : null;
  return c;
}
export function setCfg(o: any): void { S.cfg = normCfg(o); S.cfgVer++; }
setCfg(null);

/** "16h working time" */
export function tgText(t: { hours: number; always: boolean }): string { return t.hours + "h " + (t.always ? "around the clock" : "working time"); }

/** Merge `next` into the settings, describe what changed in the audit log, and save. */
export async function saveCfg(next: any): Promise<void> {
  const a = S.cfg, b = normCfg(Object.assign({}, a, next)), ch: string[] = [];
  if (a.tz !== b.tz) ch.push("Time zone " + a.tz + " → " + b.tz);
  if (a.days.join() !== b.days.join()) ch.push("Working days " + a.days.map((d) => DAYS[d]).join(" ") + " → " + b.days.map((d) => DAYS[d]).join(" "));
  if (a.start !== b.start || a.end !== b.end) ch.push("Hours " + a.start + "–" + a.end + " → " + b.start + "–" + b.end);
  if (a.holidays.join() !== b.holidays.join()) ch.push("Bank holidays updated, " + b.holidays.length + " dates");
  for (const k of Object.keys(SEV)) { const x = a.targets[k], y = b.targets[k]; if (x.hours !== y.hours || x.always !== y.always) ch.push(k + " target " + tgText(x) + " → " + tgText(y)); }
  const dl = (x: string[], y: string[], n: string) => { y.filter((v) => !x.includes(v)).forEach((v) => ch.push(n + " added: " + v)); x.filter((v) => !y.includes(v)).forEach((v) => ch.push(n + " removed: " + v)); };
  dl(a.teams, b.teams, "Team"); dl(a.categories, b.categories, "Category");
  if (a.name !== b.name) ch.push("Helpdesk name " + a.name + " → " + b.name);
  if (a.shareUrl !== b.shareUrl) ch.push("Link for shared tickets " + (b.shareUrl ? "set to " + b.shareUrl : "cleared"));
  if (a.idPrefix !== b.idPrefix) ch.push("Ticket ID prefix " + a.idPrefix + " → " + b.idPrefix);
  if (JSON.stringify(a.defaults) !== JSON.stringify(b.defaults)) ch.push("New ticket defaults: " + b.defaults.severity + ", " + CHANNELS[b.defaults.channel] + (b.defaults.team ? ", " + b.defaults.team : ""));
  const RL: Record<string, string> = { noteToResolve: "Resolution note required", timeToResolve: "Time required to resolve", maxActive: "Most active tickets per agent", soonHours: "Due-soon window (hours)", autoCloseDays: "Auto-close resolved tickets (days)", maxShiftHours: "Auto clock-out (hours)", graceDays: "Grace period after closing (days)" };
  const fr = (v: any) => v === true ? "on" : v === false || v === 0 ? "off" : String(v);
  for (const k in RL) if (a.rules[k] !== b.rules[k]) ch.push(RL[k] + ": " + fr(a.rules[k]) + " → " + fr(b.rules[k]));
  if (JSON.stringify(a.email) !== JSON.stringify(b.email)) ch.push("Email templates updated");
  if (JSON.stringify(a.announce) !== JSON.stringify(b.announce)) ch.push(b.announce ? "Announcement posted: " + b.announce.text.slice(0, 80) : "Announcement removed");
  {
    const ra = a.routing || { on: true, retry: true, cats: {} }, rb = b.routing || { on: true, retry: true, cats: {} }, nm = (k: string) => whoText(k[0] === "u" ? k.slice(2) : null, k[0] === "l" ? k.slice(2) : null);
    if (ra.on !== rb.on) ch.push(rb.on ? "Auto-assign turned on" : "Auto-assign turned off");
    if (ra.retry !== rb.retry) ch.push(rb.retry ? "Waiting tickets are auto-assigned when someone becomes available" : "Waiting tickets are no longer auto-assigned later");
    for (const k of new Set([...Object.keys(ra.cats), ...Object.keys(rb.cats)])) {
      const x = (ra.cats[k] || []).join("|"), y = (rb.cats[k] || []).join("|");
      if (x !== y) ch.push("Auto-assign order for " + k + ": " + ((rb.cats[k] || []).map(nm).join(", ") || "none"));
    }
  }
  if (a.requireShift !== b.requireShift) ch.push(b.requireShift ? "Clock-in required to take tickets" : "Clock-in no longer required");
  if (!ch.length) { toast("Nothing has changed."); return; }
  try {
    if (ref.db) await withRetry(() => ref.db.doc("config/settings").set(b)); else saveCol("config", b);
    S.cfgExists = true; setCfg(b); logEvent({ type: "settings", detail: ch.join("; ") }); commit(); toast("Saved.", "happy");
  } catch (e: any) { toast(e && e.code === "invalid_argument" ? "Only managers can change these settings." : "Settings weren't saved. Check your connection and try again.", "worried"); }
}

/**
 * Post (or update) the announcement. `until` is a datetime-local value or "".
 * Returns an error message, or null once saved.
 */
export async function announcePost(text: string, tone: string, until?: string | null): Promise<string | null> {
  text = String(text || "").trim();
  if (!text) return "Write the message first.";
  const u = until ? new Date(until) : null;
  if (u && (isNaN(+u) || u.getTime() <= Date.now())) return "Pick a time in the future, or leave it blank.";
  await saveCfg({ announce: { text, tone, until: u ? u.toISOString() : null, at: new Date().toISOString(), by: S.meId || null, byLabel: S.meId ? null : "This device" } });
  return null;
}
/** Take the announcement down. */
export function announceClear(): Promise<void> { return saveCfg({ announce: null }); }

/* ---- Admin form saves (generalSave, rulesSave, wsSave, emailsSave in the single-file edition). Each returns an error message, or null once saved. ---- */

export async function generalSave(v: { name: string; shareUrl: string; prefix: string; severity: string; channel: string; team: string }): Promise<string | null> {
  const name = String(v.name || "").trim(), pre = String(v.prefix || "").trim();
  if (!name) return "Give the helpdesk a name.";
  if (!/^[A-Za-z0-9]{1,6}$/.test(pre)) return "The prefix can be 1 to 6 letters or numbers.";
  const shareUrl = String(v.shareUrl || "").trim(); if (shareUrl && !/^https:\/\/\S+$/.test(shareUrl)) return "The sharing link needs to start with https://.";
  await saveCfg({ shareUrl, name, idPrefix: pre.toUpperCase(), defaults: { severity: v.severity, channel: v.channel, team: v.team } });
  return null;
}
export async function rulesSave(v: { requireShift: boolean; noteToResolve: boolean; timeToResolve: boolean; maxActive: any; maxShiftHours: any; soonHours: any; autoCloseDays: any; graceDays: any }): Promise<string | null> {
  let err: string | null = null;
  const chk = (val: any, lo: number, hi: number, label: string) => { const x = Number(val); if (!Number.isFinite(x) || x < lo || x > hi) { err = label + " needs a number from " + lo + " to " + hi + "."; return null; } return x; };
  const maxActive = chk(v.maxActive, 0, 200, "Most active tickets"); if (maxActive === null) return err;
  const maxShiftHours = chk(v.maxShiftHours, 0, 24, "Automatic clock-out"); if (maxShiftHours === null) return err;
  const soonHours = chk(v.soonHours, .5, 72, "Due soon"); if (soonHours === null) return err;
  const autoCloseDays = chk(v.autoCloseDays, 0, 365, "Closing resolved tickets"); if (autoCloseDays === null) return err;
  const graceDays = chk(v.graceDays, 0, 30, "The grace period"); if (graceDays === null) return err;
  await saveCfg({ requireShift: !!v.requireShift, rules: { noteToResolve: !!v.noteToResolve, timeToResolve: !!v.timeToResolve, maxActive: Math.round(maxActive), maxShiftHours, soonHours, autoCloseDays, graceDays } });
  return null;
}
/** `holidays` is the textarea text (dates separated by whitespace); `targets[k].hours` may be a string. */
export async function wsSave(v: { tz: string; days: number[]; start: string; end: string; holidays: string; targets: Record<string, { hours: any; always: boolean }> }): Promise<string | null> {
  const days = v.days || [], start = v.start, end = v.end;
  if (!days.length) return "Choose at least one working day.";
  if (!start || !end || start >= end) return "The working day has to end after it starts.";
  const hol = String(v.holidays || "").split(/\s+/).filter(Boolean), bad = hol.find((x) => !/^\d{4}-\d\d-\d\d$/.test(x) || isNaN(+new Date(x)));
  if (bad) return bad + " isn't a date in YYYY-MM-DD form.";
  const targets: Record<string, { hours: number; always: boolean }> = {};
  for (const k of Object.keys(SEV)) { const t = (v.targets || {})[k] || { hours: "", always: false }, h = parseFloat(t.hours); if (!(h > 0 && h <= 2000)) return "Give " + k + " a target between 0 and 2000 hours."; targets[k] = { hours: h, always: !!t.always }; }
  await saveCfg({ tz: v.tz, days, start, end, holidays: [...new Set(hol)].sort(), targets });
  return null;
}
export async function emailsSave(v: { app: string; templates: Record<string, { on: boolean; subject: string; body: string }> }): Promise<string | null> {
  const t: Record<string, { on: boolean; subject: string; body: string }> = {};
  for (const k of Object.keys(EM_EVENTS)) {
    const x = (v.templates || {})[k] || { on: false, subject: "", body: "" }, sub = String(x.subject || "").trim(), body = String(x.body || "").trim();
    if (!sub || !body) return "Each email needs a subject and a message.";
    t[k] = { on: !!x.on, subject: sub, body };
  }
  await saveCfg({ email: { app: v.app, templates: t } });
  return null;
}
