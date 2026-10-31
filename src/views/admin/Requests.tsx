import { useState, type ReactNode } from "react";
import { S, toast } from "../../core/state.ts";
import { CH_FIELDS } from "../../core/constants.ts";
import { rel } from "../../core/format.ts";
import { allRequests, safePhoto, chValue, decide, approveRequest } from "../../core/requests.ts";
import { useApp, Ava, Who } from "../../ui/index.tsx";
import { gotoTicket } from "./shared.tsx";

/** reqText(r, true): what a request asks for, with names and a ticket link. */
export function ReqText({ r }: { r: any }) {
  const t = r.ticketId ? S.byId.get(r.ticketId) : null;
  const tl = r.ticketId
    ? <button className="linkbtn tid" style={{ borderBottomColor: "var(--line)" }} data-act="goto" data-id={r.ticketId} onClick={() => gotoTicket(r.ticketId)}>{r.ticketId}</button>
    : null;
  const subj = t ? " (" + t.subject.slice(0, 60) + ")" : "";
  const w = (u: any, l: any) => <Who uid={u} label={l} />;
  const has = !!(r.from || r.fromLabel);
  let out: ReactNode;
  switch (r.type) {
    case "assign": {
      const self = r.to === r.uid;
      out = <>{self ? "asks to take " : "asks to assign "}{tl}{self ? null : <>{" to "}{w(r.to, r.toLabel)}</>}
        {has && !self ? <>{", currently with "}{w(r.from, r.fromLabel)}</> : has ? <>{" from "}{w(r.from, r.fromLabel)}</> : null}{subj}</>;
      break;
    }
    case "unassign": out = <>{"asks to unassign "}{tl}{has ? <>{" from "}{w(r.from, r.fromLabel)}</> : null}{subj}</>; break;
    case "photo": out = "asks for a new profile photo"; break;
    case "reopen": out = <>{"asks to reopen "}{tl}{subj}</>; break;
    case "reorder": {
      const ownr = (r.colUid || r.colLabel) ? (r.colUid === r.uid ? "their" : <>{w(r.colUid, r.colLabel)}{"'s"}</>) : "the Unassigned";
      out = <>{"asks to move "}{tl}{" to position " + (r.pos || "?") + " in "}{ownr}{" list"}{subj}</>;
      break;
    }
    case "change": out = r.field === "other" ? "asks for a change" : "asks to change their " + ((CH_FIELDS as any)[r.field] || "details").toLowerCase() + " to " + chValue(r); break;
    default: out = "has a request";
  }
  return <>{out}</>;
}

/** reqRow(r, acts): one request, with Approve and Decline for managers when `acts`. */
export function ReqRow({ r, acts, decline, setDecline }: { r: any; acts: boolean; decline?: string | null; setDecline?: (id: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const pill = r.status === "approved" ? <span className="pill ok">Approved</span> : r.status === "declined" ? <span className="pill no">Declined</span> : <span className="pill wait">Waiting</span>;
  const ph = r.type === "photo" ? safePhoto(r.photo) : null;
  const approve = () => { setBusy(true); approveRequest(r).finally(() => setBusy(false)); };
  const declineGo = () => {
    decide(r.uid, r.id, false, reason.trim().slice(0, 200)).then((ok) => {
      if (ok) { if (setDecline) setDecline(null); toast("Declined."); }
    });
  };
  return (
    <div className="rq"><div className="rq-top"><Ava uid={r.uid} label={null} size={30} />
      <div className="rq-main">
        <div className="rq-line"><b><Who uid={r.uid} label={null} /></b> <ReqText r={r} /></div>
        <div className="rq-meta">{pill}<span>{rel(r.at)}</span>{r.dec && r.dec.by ? <span>by <Who uid={r.dec.by} label={null} /></span> : null}</div>
        {r.note ? <div className="rq-note">{r.note}</div> : null}
        {ph ? <img className="rq-photo" alt="Requested photo" src={ph} /> : null}
        {r.dec && r.dec.reason ? <div className="rq-note" style={{ background: "color-mix(in srgb,var(--warn) 8%,var(--bg))" }}>{r.dec.reason}</div> : null}
        {acts && r.status === "pending"
          ? (decline === r.id
            ? <div className="rq-acts">
                <input className="field" id={"rqd-" + r.id} maxLength={200} placeholder="Reason (optional)" aria-label="Reason for declining" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
                <button className="btn" data-act="rq-no-cancel" onClick={() => { if (setDecline) setDecline(null); setReason(""); }}>Back</button>
                <button className="btn dark" data-act="rq-no-go" data-id={r.id} onClick={declineGo}>Decline</button>
              </div>
            : <div className="rq-acts">
                <button className="btn primary" data-act="rq-yes" data-id={r.id} disabled={busy} onClick={approve}>Approve</button>
                <button className="btn" data-act="rq-no" data-id={r.id} onClick={() => { if (setDecline) setDecline(r.id); }}>Decline</button>
              </div>)
          : null}
      </div>
    </div></div>
  );
}

/** adRequests(): requests from agents, waiting or all. */
export function Requests() {
  useApp();
  const [filter, setFilter] = useState("pending");
  const [decline, setDecline] = useState<string | null>(null);
  const all = allRequests(), list = filter === "pending" ? all.filter((r: any) => r.status === "pending") : all;
  return (
    <div className="card adcard" style={{ maxWidth: 820 }}>
      <div className="cardhead"><h3>Requests from agents</h3>
        <div className="pills">
          <button data-act="rq-filter" data-f="pending" aria-pressed={filter === "pending"} onClick={() => setFilter("pending")}>Waiting ({all.filter((r: any) => r.status === "pending").length})</button>
          <button data-act="rq-filter" data-f="all" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
        </div>
      </div>
      <p className="muted">Agents send these when they try something only managers can do, like moving a ticket to someone else or changing their profile.</p>
      {list.length
        ? list.map((r: any) => <ReqRow key={r.id} r={r} acts decline={decline} setDecline={setDecline} />)
        : <p className="muted">{filter === "pending" ? "Nothing waiting." : "No requests yet."}</p>}
    </div>
  );
}
