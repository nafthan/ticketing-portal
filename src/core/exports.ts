/* CSV and Markdown exports, offered through save(). */
import { S } from "./state.ts";
import { SEV, ST_LABEL, CHANNELS, EV_LABEL } from "./constants.ts";
import { abs } from "./format.ts";
import { save } from "./data.ts";
import { sla } from "./hours.ts";
import { custName, whoText } from "./people.ts";
import { noteMins } from "./tickets.ts";
import { repSet } from "./reports.ts";
import { auditRows, evText, eventText } from "./audit.ts";
import { histRows } from "./history.ts";

/** Rows to CSV. Cells starting with = + - @ are prefixed with ' so spreadsheets don't run them. */
export function csv(rows: any[][]): string { return rows.map((r) => r.map((v) => { v = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }).join(",")).join("\r\n"); }
const today = () => new Date().toISOString().slice(0, 10);
/** The tickets in the current report range. */
export function exportTickets(): Promise<void> {
  const rows: any[][] = [["ID", "Subject", "Customer", "Requester", "Requester email", "Team", "Category", "Severity", "Status", "Assignee", "Channel", "Opened", "Resolved", "SLA due", "SLA", "Minutes logged", "Billable minutes"]];
  for (const t of repSet()) rows.push([t.id, t.subject, custName(t), t.requesterName, t.requesterEmail, t.team, t.category, t.severity, ST_LABEL[t.status], (t.assigneeId || t.assigneeLabel) ? whoText(t.assigneeId, t.assigneeLabel) : "", CHANNELS[t.channel as string] || "", t.createdAt, t.resolvedAt || "", sla(t).due ? new Date(sla(t).due as number).toISOString() : "", sla(t).text, noteMins(t)[0], noteMins(t)[1]]);
  return save("helpdesk-tickets-" + today() + ".csv", csv(rows));
}
/** The audit rows matching the current filters. */
export function exportAudit(): Promise<void> {
  const rows: any[][] = [["Time (UTC)", "Who", "Record", "Customer", "Event", "Detail"]];
  for (const { t, e } of auditRows()) rows.push([e.at, whoText(e.by, e.byLabel), t ? t.id : e.type === "share" ? e.ref || "" : e.type === "customer" ? e.name || "" : ({ staff: "Team", shift: "Shift", request: "Request", queue: "Dispatch", pin: "Pinned" } as Record<string, string>)[e.type] || "Settings", t ? custName(t) : e.type === "customer" ? e.name || "" : "",
    EV_LABEL[e.type] || e.type, t ? (e.type === "created" ? t.subject : evText(e)) : eventText(e)]);
  return save("helpdesk-audit-" + today() + ".csv", csv(rows));
}
/** Time entries in the current report range. */
export function exportTime(): Promise<void> {
  const from = S.rep.range ? Date.now() - S.rep.range * 864e5 : 0, rows: any[][] = [["Date (UTC)", "Ticket", "Customer", "Subject", "Logged by", "Minutes", "Hours", "Billable", "Note"]];
  for (const t of S.tickets) { if (S.rep.team && t.team !== S.rep.team) continue; for (const n of t.notes || []) if ((n.minutes as number) > 0 && new Date(n.at).getTime() >= from) rows.push([n.at, t.id, custName(t), t.subject, whoText(n.by, n.byLabel), n.minutes, ((n.minutes as number) / 60).toFixed(2), n.billable ? "Yes" : "No", n.text || ""]); }
  return save("helpdesk-time-" + today() + ".csv", csv(rows));
}
/** Closed tickets matching the History filters. */
export function exportHistory(): Promise<void> {
  const rows: any[][] = [["ID", "Subject", "Customer", "Requester", "Category", "Team", "Severity", "Handled by", "Opened", "Closed", "Closed by", "Hours to close", "Minutes logged", "Billable minutes", "SLA"]];
  for (const r of histRows()) { const t = r.t; rows.push([t.id, t.subject, custName(t), t.requesterName, t.category, t.team, t.severity, (t.assigneeId || t.assigneeLabel) ? whoText(t.assigneeId, t.assigneeLabel) : "", t.createdAt, r.c.at, r.c.auto ? "Automatic" : (r.c.by || r.c.byLabel) ? whoText(r.c.by, r.c.byLabel) : "", (r.took / 36e5).toFixed(1), r.mins, noteMins(t)[1], sla(t).text]); }
  return save("helpdesk-closed-" + today() + ".csv", csv(rows));
}
/** The incident timeline of a ticket (default: the open one) as Markdown. */
export function downloadTimeline(id: string | null = S.sel): Promise<void> | void {
  const t = id ? S.byId.get(id) : undefined; if (!t) return;
  const en = (t.timeline || []).slice().sort((a, b) => a.at < b.at ? -1 : 1), cell = (v: any) => String(v || "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
  const md = "# Incident timeline: " + t.id + "\n\n**" + cell(t.subject) + "**\n\nCustomer: " + cell(custName(t)) + "  \nSeverity: " + t.severity + " " + SEV[t.severity].label + "  \nStatus: " + ST_LABEL[t.status] + "  \nOpened: " + abs(t.createdAt) +
    "\n\n| When | Phase | What happened | Recorded by |\n|---|---|---|---|\n" + en.map((e) => "| " + abs(e.at) + " | " + e.phase + " | " + cell(e.text) + " | " + cell(whoText(e.by, e.byLabel)) + " |").join("\n") +
    "\n\nTimes are in " + (Intl.DateTimeFormat().resolvedOptions().timeZone || "local time") + ".\n";
  return save("incident-timeline-" + t.id + ".md", md);
}
