import { useState } from "react";
import { S, svc, commit } from "../core/state.ts";
import { EV_LABEL } from "../core/constants.ts";
import { abs, pad } from "../core/format.ts";
import { custName } from "../core/people.ts";
import { auditRows, evText, eventText } from "../core/audit.ts";
import { exportAudit } from "../core/exports.ts";
import { useApp, Icon, Person } from "../ui/index.tsx";
import { gotoTicket, gotoCustomer } from "./admin/shared.tsx";

const OTHER: Record<string, string> = { staff: "Team", shift: "Shift", request: "Request", queue: "Dispatch", pin: "Pinned" };

/** renderAudit() */
export function Audit() {
  useApp();
  const [text, setText] = useState(S.aud.text);
  const rows: { t?: any; e: any }[] = auditRows(), shown = rows.slice(0, S.aud.limit);
  const setAud = (k: string, v: any) => { (S.aud as any)[k] = v; commit(); };
  const link = { borderBottomColor: "var(--line)" };

  return (
    <>
      <div className="pagehead">
        <div><h1>Audit log</h1><p>Every change to tickets, customers, the team and settings, with who made it and when. Entries are written with the change itself and this page has no way to edit them.</p></div>
        <button className="btn dark" data-act="export-audit" id="a-export" hidden={!svc.downloads} onClick={() => exportAudit()}>Export CSV</button>
      </div>
      <div className="toolbar">
        <div className="searchbox" id="a-sb"><Icon name="search" /><input className="field" id="a-text" type="search" placeholder="Search ticket ID, subject, customer" aria-label="Search audit log" value={text}
          onChange={(e) => { setText(e.target.value); S.aud.text = e.target.value.trim(); S.aud.limit = 200; commit(); }} /></div>
        <select className="field" id="a-type" aria-label="Event type" value={S.aud.type} onChange={(e) => setAud("type", e.target.value)}>
          <option value="">All events</option><option value="created">Ticket opened</option><option value="status">Status changes</option><option value="severity">Severity changes</option><option value="assignee">Assignments</option><option value="team">Team changes</option><option value="category">Category changes</option><option value="note">Notes and time</option><option value="email">Emails</option><option value="channel">Channel changes</option><option value="timeline">Incident timeline</option><option value="customer">Customer records</option><option value="staff">Team changes</option><option value="settings">Settings</option><option value="shift">Shifts</option><option value="request">Requests</option><option value="queue">Dispatch order</option><option value="share">Shared to Teams</option><option value="pin">Pinned messages</option>
        </select>
        <select className="field" id="a-range" aria-label="Period" value={String(S.aud.range)} onChange={(e) => setAud("range", +e.target.value)}>
          <option value="0">All time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option>
        </select>
        <select className="field" id="a-who" aria-label="Actor" value={S.aud.who} onChange={(e) => setAud("who", e.target.value)}><option value="">Anyone</option><option value="me">Only my changes</option></select>
      </div>
      <div className="card tablecard"><div className="scroll-x">
        <table>
          <thead><tr><th>Time</th><th>Who</th><th>Record</th><th>Event</th><th>Detail</th></tr></thead>
          <tbody id="a-body">
            {shown.map(({ t, e }, i) => (
              <tr key={i}>
                <td className="num muted">{abs(e.at) + ":" + pad(new Date(e.at).getSeconds())}</td>
                <td><Person uid={e.by} label={e.byLabel || "Unknown"} /></td>
                <td>{t
                  ? <button className="linkbtn tid" style={link} data-act="goto" data-id={t.id} onClick={() => gotoTicket(t.id)}>{t.id}</button>
                  : e.type === "share" && e.ref
                    ? <button className="linkbtn tid" style={link} data-act="goto" data-id={e.ref} onClick={() => gotoTicket(e.ref)}>{e.ref}</button>
                    : e.type === "customer"
                      ? <button className="linkbtn" style={link} data-act="cust-goto" data-cid={e.ref || ""} data-name={e.name || ""} onClick={() => gotoCustomer(e.ref || "", e.name || "")}>{e.name || "Customer"}</button>
                      : <span className="muted">{OTHER[e.type] || "Settings"}</span>}
                </td>
                <td>{(EV_LABEL as any)[e.type] || e.type}</td>
                <td className="wrap muted">{t ? (e.type === "created" ? t.subject + ", " + custName(t) : evText(e)) : eventText(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="empty" id="a-empty" hidden={rows.length > 0}>
          {!S.loaded ? "Loading" : (S.tickets.length || S.events.length)
            ? <><b>No events match these filters</b>Widen the period or clear the search.</>
            : <><b>Nothing recorded yet</b>Events appear here as tickets, customers and settings change.</>}
        </div>
      </div></div>
      <div style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center" }}>
        <span className="muted" id="a-count">{rows.length ? shown.length + " of " + rows.length + " events" : ""}</span>
        <button className="btn" data-act="audit-more" id="a-more" hidden={rows.length <= S.aud.limit} onClick={() => setAud("limit", S.aud.limit + 200)}>Show more</button>
      </div>
    </>
  );
}
