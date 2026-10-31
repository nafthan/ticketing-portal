/*
 * Ask a manager (#rq): openRequest and sendRequest in the single-file edition.
 * `draft` is the request item openRequest() was given, such as
 * {type: "reopen", ticketId} or {type: "assign", ticketId, to, toLabel, from, fromLabel}.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { S, closeDialog, setView } from "../core/state.ts";
import { CH_FIELDS } from "../core/constants.ts";
import { safePhoto, chValue, sendRequest } from "../core/requests.ts";
import { openTicket } from "../core/tickets.ts";
import { resetFilters } from "../core/queue.ts";
import { useApp, Dialog, Icon, Who } from "../ui/index.tsx";

const WHY: Record<string, string> = {
  assign: "Only managers can assign tickets to someone else, or move a ticket that's already assigned.",
  unassign: "Only managers can unassign a ticket that belongs to someone else.",
  reorder: "Only managers can change the order of tickets in a list.",
  reopen: "Only managers can reopen a ticket that's fully closed.",
  photo: "Profile photos are managed by managers.",
  change: "Your profile details are managed by managers.",
};

/** The legacy `goto` action: show the ticket in the Queue under All. */
function gotoTicket(id: string) {
  resetFilters();
  S.q.status = "all";
  openTicket(id);
  setView("queue");
}

/**
 * reqText({uid: me, ...item}, true) with its leading "asks " turned into "ask ",
 * as the summary line in the single-file edition.
 */
function YouAsk({ r }: { r: any }): ReactNode {
  const me = S.meId, t = r.ticketId ? S.byId.get(r.ticketId) : null;
  const tl = r.ticketId ? <button className="linkbtn tid" style={{ borderBottomColor: "var(--line)" }} data-act="goto" data-id={r.ticketId} onClick={() => gotoTicket(r.ticketId)}>{r.ticketId}</button> : null;
  const subj = t ? " (" + t.subject.slice(0, 60) + ")" : "";
  const W = (uid: any, label: any) => <Who uid={uid} label={label} />;
  const hasFrom = !!(r.from || r.fromLabel);
  switch (r.type) {
    case "assign":
      return <>{r.to === me ? "ask to take " : "ask to assign "}{tl}{r.to === me ? null : <>{" to "}{W(r.to, r.toLabel)}</>}
        {hasFrom && r.to !== me ? <>{", currently with "}{W(r.from, r.fromLabel)}</> : hasFrom ? <>{" from "}{W(r.from, r.fromLabel)}</> : null}{subj}</>;
    case "unassign":
      return <>{"ask to unassign "}{tl}{hasFrom ? <>{" from "}{W(r.from, r.fromLabel)}</> : null}{subj}</>;
    case "photo": return "ask for a new profile photo";
    case "reopen": return <>{"ask to reopen "}{tl}{subj}</>;
    case "reorder": {
      const ownr = (r.colUid || r.colLabel) ? (r.colUid === me ? "their" : <>{W(r.colUid, r.colLabel)}{"'s"}</>) : "the Unassigned";
      return <>{"ask to move "}{tl}{" to position " + (r.pos || "?") + " in "}{ownr}{" list"}{subj}</>;
    }
    case "change":
      return r.field === "other" ? "ask for a change" : "ask to change their " + String((CH_FIELDS as any)[r.field] || "details").toLowerCase() + " to " + chValue(r);
    default: return "has a request";
  }
}

export function RequestDialog({ draft }: { draft: any }) {
  useApp();
  const [note, setNote] = useState(draft && draft.note ? String(draft.note) : "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  if (!draft) return null;

  const photo = draft.type === "photo" ? safePhoto(draft.photo) : null;
  const send = async () => {
    setErr("");
    setBusy(true);
    const r = await sendRequest(draft, note.trim());
    if (typeof r === "string" && r) { setBusy(false); setErr(r); ref.current?.focus(); return; }
    setBusy(false);
    if (r !== false && S.dialog && S.dialog.kind === "request") closeDialog();
  };

  return (
    <Dialog id="rq" className="dlg narrow" labelledBy="rq-h" onClose={closeDialog}>
      <div className="d-top"><span className="lbl">Needs a manager</span>
        <button className="x" data-act="rq-cancel" aria-label="Close" onClick={closeDialog}><Icon name="x" /></button>
      </div>
      <h2 id="rq-h">Ask a manager?</h2>
      <p className="muted" id="rq-text">{(WHY[draft.type] || "This needs a manager.") + " You can send this to a manager to approve."}</p>
      <div className="rq-sum" id="rq-sum">
        {photo ? <img className="rq-photo" style={{ margin: "0 0 8px" }} alt="" src={photo} /> : null}
        <span>You <YouAsk r={draft} />.</span>
      </div>
      <div className="form" style={{ gridTemplateColumns: "1fr", marginTop: 12 }}>
        <label><span className="lbl">Note for the manager (optional)</span>
          <textarea ref={ref} className="field" id="rq-note" rows={3} maxLength={600} placeholder="e.g. Tom knows this customer's firewall"
            value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <div className="err" id="rq-err">{err}</div>
        <div className="actions">
          <button className="btn" data-act="rq-cancel" onClick={closeDialog}>Cancel</button>
          <button className="btn primary" data-act="rq-send" id="rq-send" disabled={busy} onClick={send}>Send request</button>
        </div>
      </div>
    </Dialog>
  );
}
