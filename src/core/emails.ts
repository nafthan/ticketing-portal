/*
 * Customer emails. The helpdesk can't send mail, so on each event it writes
 * the email onto the ticket (status "pending") for an agent to open and send.
 */
import { S } from "./state.ts";
import { SEV, ST_LABEL } from "./constants.ts";
import { newId } from "./data.ts";
import { custOf, custName, whoText } from "./people.ts";
import { siteOf, patchTicket } from "./tickets.ts";
import type { Email, Ticket } from "./types.ts";

/** The text of the latest "Resolution: …" note. */
export function lastResolution(t: Partial<Ticket>): string {
  const ns = (t.notes || []).filter((n) => n.text); const r = ns.filter((n) => /^Resolution:/.test(n.text)).slice(-1)[0] || null;
  return r ? r.text.replace(/^Resolution:\s*/, "") : "";
}
export function emailTo(t: Partial<Ticket>): string { const c = custOf(t), con = c && t.contactId ? (c.contacts || []).find((k) => k.id === t.contactId) : null; return (con && con.email) || t.requesterEmail || ""; }
/** The values for template placeholders. */
export function emailVars(t: any): Record<string, string> {
  const c = custOf(t), con = c && t.contactId ? (c.contacts || []).find((k) => k.id === t.contactId) : null, nm = (con && con.name) || t.requesterName || "", st = siteOf(t);
  return {
    ticket: t.id, subject: t.subject || "", contact: nm ? nm.split(/\s+/)[0] : "there", customer: custName(t), site: st ? st.name : "", severity: t.severity + " " + ((SEV[t.severity] || ({} as any)).label || ""),
    status: ST_LABEL[t.status] || t.status, agent: (t.assigneeId || t.assigneeLabel) ? whoText(t.assigneeId, t.assigneeLabel) : "the " + S.cfg.name + " team", resolution: lastResolution(t),
    closingDate: t.closingUntil ? new Date(t.closingUntil).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "", helpdesk: S.cfg.name, link: S.cfg.shareUrl || "",
  };
}
/** Fill {placeholders}; unknown ones are left as written. */
export function fillTpl(str: any, v: Record<string, string>): string { return String(str || "").replace(/\{(\w+)\}/g, (m, k) => Object.prototype.hasOwnProperty.call(v, k) ? v[k] : m).replace(/\n{3,}/g, "\n\n").trim(); }
/** The pending email for an event (opened | resolved | closing | closed), or null when that template is off. */
export function mkEmail(t: any, kind: string): Email | null {
  const tp = S.cfg.email.templates[kind]; if (!tp || !tp.on) return null; const v = emailVars(t);
  return { id: newId("m"), event: kind, to: emailTo(t), subject: fillTpl(tp.subject, v), body: fillTpl(tp.body, v), at: new Date().toISOString(), status: "pending" };
}
/** A link that opens the email ready to send, in Outlook on the web or the default mail app. */
export function composeUrl(m: Email): string {
  return S.cfg.email.app === "mailto" ? "mailto:" + encodeURIComponent(m.to).replace(/%40/g, "@") + "?subject=" + encodeURIComponent(m.subject) + "&body=" + encodeURIComponent(m.body)
    : "https://outlook.office.com/mail/deeplink/compose?to=" + encodeURIComponent(m.to) + "&subject=" + encodeURIComponent(m.subject) + "&body=" + encodeURIComponent(m.body);
}
/** Mark a pending email as "sent" or "skipped". */
export function setEmail(tid: string, mid: string, status: "sent" | "skipped"): Promise<boolean> {
  return patchTicket(tid, (t) => {
    const m = (t.emails || []).find((x) => x.id === mid); if (!m || m.status !== "pending") return null;
    return { changes: { emails: (t.emails || []).map((x) => x.id === mid ? Object.assign({}, x, { status, doneAt: new Date().toISOString(), doneBy: S.meId || null }) : x) }, events: [{ type: "email", action: status, subject: m.subject, to: m.to }] };
  });
}
