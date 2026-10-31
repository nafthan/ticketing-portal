/* The audit log: ticket history plus workspace events (S.aud). Text helpers return plain text. */
import { S } from "./state.ts";
import { SEV, ST_LABEL, CHANNELS, AVAIL } from "./constants.ts";
import { fmtMin } from "./format.ts";
import { whoText, custName } from "./people.ts";
import type { AuditEvent, HistoryEntry, Ticket } from "./types.ts";

/** A ticket history entry as text (without the EV_LABEL prefix). */
export function evText(e: HistoryEntry): string {
  const w = whoText, ar = " → ";
  switch (e.type) {
    case "created": return "Ticket opened";
    case "status": return (ST_LABEL[e.from] || e.from) + ar + (ST_LABEL[e.to] || e.to) + (e.auto ? ", automatically" : "") + (e.reason ? ". " + e.reason : "");
    case "email": return (e.action === "sent" ? "Marked as sent" + (e.to ? " to " + e.to : "") : "Skipped") + ": " + (e.subject || "");
    case "severity": return e.from + " " + (SEV[e.from] || ({} as any)).label + ar + e.to + " " + (SEV[e.to] || ({} as any)).label;
    case "team": case "category": return e.from + ar + e.to;
    case "channel": return (CHANNELS[e.from] || "Not recorded") + ar + (CHANNELS[e.to] || e.to);
    case "assignee": return ((e.from || e.fromLabel) ? w(e.from, e.fromLabel) : "Unassigned") + ar + ((e.to || e.toLabel) ? w(e.to, e.toLabel) : "Unassigned") + (e.auto ? ", automatically" + (e.reason ? " (" + e.reason + ")" : "") : "");
    case "note": return (e.timeOnly ? "Time logged" : e.internal ? "Internal note" : "Customer-visible note") + (e.minutes ? ", " + fmtMin(e.minutes) + (e.billable ? " billable" : " non-billable") : "");
    case "timeline": return e.started ? "Incident timeline started" : "Timeline entry, " + e.phase;
    default: return "";
  }
}
/** A workspace event (customer, staff, shift, share, queue, request, settings, pin) as text. */
export function eventText(e: AuditEvent): string {
  const w = whoText;
  if (e.type === "customer") return (({ created: "Customer created", "contact-added": "Contact added: ", "contact-updated": "Contact updated: ", "contact-removed": "Contact removed: " } as Record<string, string>)[e.action] || "") + (e.detail || "");
  if (e.type === "staff") {
    const p = (e.target || e.targetLabel) ? w(e.target, e.targetLabel) : "Someone";
    if (e.action === "updated") return p + " updated: " + (e.detail || "");
    if (e.action === "joined" || e.action === "left") return p + (e.action === "joined" ? " added to " : " removed from ") + (e.detail || "a team");
    return p + (e.action === "added" ? " added to the team" : e.action === "removed" ? " removed from the team" : e.action === "team" ? " team: " + (e.from || "none") + " → " + (e.to || "none")
      : e.action === "avail" ? " status: " + (AVAIL[e.from] || "Available") + " → " + (AVAIL[e.to] || e.to) : e.action === "oncall" ? (e.to ? " now on call" : " no longer on call") : "");
  }
  if (e.type === "shift") { const p = (e.target || e.targetLabel) ? w(e.target, e.targetLabel) : "Someone"; return p + (e.action === "in" ? " clocked in" : " clocked out" + (e.auto ? " automatically" : "") + (e.minutes != null ? " after " + fmtMin(e.minutes) : "")); }
  if (e.type === "share") return e.detail || "Shared";
  if (e.type === "queue") {
    const p = (e.target || e.targetLabel) ? w(e.target, e.targetLabel) + "'s" : "The Unassigned";
    return e.action === "reset" ? p + " list went back to automatic order" : (e.detail || "A ticket") + " moved in " + p + " list";
  }
  if (e.type === "request") { const p = e.target ? w(e.target, null) : "Someone"; return e.action === "created" ? p + " asked: " + (e.detail || "") : (e.action === "approved" ? "Approved " : "Declined ") + "a request from " + p + ": " + (e.detail || ""); }
  if (e.type === "settings") return e.detail || "Settings changed";
  if (e.type === "pin") return (({ created: "Pinned: ", updated: "Edited pinned message: ", removed: "Unpinned: " } as Record<string, string>)[e.action] || "") + (e.detail || "");
  return "";
}
/** Audit rows matching S.aud, newest first. `t` is set for ticket history entries. */
export function auditRows(): { t?: Ticket; e: any }[] {
  const a = S.aud, from = a.range ? Date.now() - a.range * 864e5 : 0, n = a.text.toLowerCase(), tt = a.type, out: { t?: Ticket; e: any }[] = [], other = ["customer", "staff", "settings", "shift", "request", "queue", "share", "pin"];
  const ok = (e: any) => !(from && new Date(e.at).getTime() < from) && !(a.who === "me" && (!S.meId || e.by !== S.meId));
  if (!other.includes(tt)) for (const t of S.tickets) {
    if (n && !(t.id + " " + t.subject + " " + custName(t)).toLowerCase().includes(n)) continue;
    for (const e of t.history || []) { if (tt && e.type !== tt) continue; if (ok(e)) out.push({ t, e }); }
  }
  if (!tt || other.includes(tt)) for (const e of S.events) {
    if (tt && e.type !== tt) continue; if (n && !(String(e.name || "") + " " + String(e.detail || "") + " " + String(e.ref || "")).toLowerCase().includes(n)) continue; if (ok(e)) out.push({ e });
  }
  return out.sort((x, y) => x.e.at < y.e.at ? 1 : x.e.at > y.e.at ? -1 : 0);
}
