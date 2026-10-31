/* Share a ticket to Teams (or anywhere) as a short message. */
import { S } from "./state.ts";
import { SEV, ST_LABEL } from "./constants.ts";
import { esc } from "./format.ts";
import { logEvent } from "./data.ts";
import { sla } from "./hours.ts";
import { custOf, custName, whoText, isMgr } from "./people.ts";
import type { Ticket } from "./types.ts";

/** Options from the share dialog's checkboxes. */
export interface ShareOpts { desc?: boolean; note?: boolean }
const DEF_OPTS: ShareOpts = { desc: true, note: false };

/** Running without a backend (links point at this page). */
export function standalone(): boolean { return typeof window === "undefined" || !(window as any).helpdesk || S.mode === "local"; }
/** A link to the ticket, or "" when there isn't one to give. */
export function ticketLink(t: Ticket): string {
  if (standalone()) { if (typeof location === "undefined") return ""; const b = location.href.split("#")[0]; return /^https:/.test(b) ? b + "#ticket=" + encodeURIComponent(t.id) : ""; }
  return S.cfg.shareUrl || "";
}
export function shareParts(t: Ticket, o: ShareOpts = DEF_OPTS) {
  const c = custOf(t), con = c && t.contactId ? (c.contacts || []).find((k) => k.id === t.contactId) : null, rn = (con && con.name) || t.requesterName, s = sla(t);
  const who = (t.assigneeId || t.assigneeLabel) ? "assigned to " + whoText(t.assigneeId, t.assigneeLabel) : "unassigned";
  const lastNote = (t.notes || []).filter((n) => !n.internal && n.text).slice(-1)[0];
  return {
    head: t.id + ": " + t.subject, meta: t.severity + " " + SEV[t.severity].label + " | " + (ST_LABEL[t.status] || t.status) + ", " + who,
    cust: custName(t) + (rn ? " (" + rn + ")" : ""), sla: s.text, team: t.team + ", " + t.category,
    desc: o.desc && t.description ? t.description : "", note: o.note && lastNote ? lastNote.text : "", link: ticketLink(t),
  };
}
export function sharePlain(t: Ticket, o: ShareOpts = DEF_OPTS): string {
  const p = shareParts(t, o);
  return [p.head, p.meta, "Customer: " + p.cust, "SLA: " + p.sla, "Team: " + p.team].concat(p.desc ? ["", "Description:", p.desc] : []).concat(p.note ? ["", "Latest update:", p.note] : [])
    .concat(p.link ? ["", "Open in " + S.cfg.name + ": " + p.link + (standalone() ? "" : " (search for " + t.id + ")")] : []).join("\n");
}
/** The same message as HTML, for pasting with formatting. */
export function shareHtml(t: Ticket, o: ShareOpts = DEF_OPTS): string {
  const p = shareParts(t, o), br = (v: string) => esc(v).replace(/\n/g, "<br>");
  return "<p><b>" + esc(p.head) + "</b><br>" + esc(p.meta) + "<br>Customer: " + esc(p.cust) + "<br>SLA: " + esc(p.sla) + "<br>Team: " + esc(p.team) + "</p>" +
    (p.desc ? "<p><b>Description</b><br>" + br(p.desc) + "</p>" : "") + (p.note ? "<p><b>Latest update</b><br>" + br(p.note) + "</p>" : "") +
    (p.link ? '<p><a href="' + esc(p.link) + '">Open in ' + esc(S.cfg.name) + "</a>" + (standalone() ? "" : " (search for " + esc(t.id) + ")") + "</p>" : "");
}
/** The Teams share link for a ticket, or "" when there's no link to share (renderShare in the single-file edition). */
export function teamsShareUrl(t: Ticket): string {
  const link = ticketLink(t); if (!link) return "";
  const msg = t.id + ": " + t.subject + " (" + t.severity + " " + SEV[t.severity].label + ", " + (ST_LABEL[t.status] || t.status) + ")";
  return "https://teams.microsoft.com/share?href=" + encodeURIComponent(link) + "&msgText=" + encodeURIComponent(msg.slice(0, 300)) + "&preview=true";
}
/** Why Share to Teams is unavailable, or "" when it is. */
export function shareNoLinkText(t: Ticket): string {
  return ticketLink(t) ? "" : isMgr() ? "Add the link people open the helpdesk at, under Admin, General, to share to Teams. You can still copy the message." : "A manager needs to add the helpdesk's link under Admin, General before tickets can be shared to Teams. You can still copy the message.";
}
/** Log that Share to Teams was opened. */
export function logTeamsShare(t: Ticket): void { logEvent({ type: "share", ref: t.id, detail: "Opened Share to Teams" }); }
/**
 * Copy the message (with formatting where the browser allows). Logs the share when it worked.
 * Resolves true when copied. On false the caller should select the text and show
 * "Your browser blocked copying. The message is selected, so press Ctrl+C (or Cmd+C) to copy it."
 */
export async function copyShare(t: Ticket | string, o: ShareOpts = DEF_OPTS): Promise<boolean> {
  const tk = typeof t === "string" ? S.byId.get(t) : t; if (!tk) return false;
  const plain = sharePlain(tk, o), html = shareHtml(tk, o), w: any = typeof window !== "undefined" ? window : null, nav: any = typeof navigator !== "undefined" ? navigator : null;
  let ok = false;
  try { if (nav && nav.clipboard && w && w.ClipboardItem) { await nav.clipboard.write([new w.ClipboardItem({ "text/plain": new Blob([plain], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) })]); ok = true; } } catch (e) { /* try the next way */ }
  if (!ok) try { if (nav && nav.clipboard) { await nav.clipboard.writeText(plain); ok = true; } } catch (e) { /* try the next way */ }
  if (!ok) try { const ta = document.createElement("textarea"); ta.value = plain; document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); ta.remove(); } catch (e) { /* blocked */ }
  if (ok) logEvent({ type: "share", ref: tk.id, detail: "Copied for Teams" });
  return ok;
}
