/*
 * Pinned messages at the top of the Queue or Dispatch (renderPins).
 * Renders its own container (#pins-q or #pins-d, class "pins"), which stays
 * empty when there's nothing to show so `.pins:empty` applies.
 */
import { useState } from "react";
import { S, openDialog } from "../core/state.ts";
import { esc, linkify, rel, shortDate } from "../core/format.ts";
import { isMgr } from "../core/people.ts";
import { pinsFor, removePin } from "../core/pins.ts";
import { useApp, Icon, Person } from "../ui/index.tsx";

function pinsHidden(): boolean {
  try { return localStorage.getItem("helpdesk.pinsHidden") === "1"; } catch (e) { return false; }
}

export function Pins({ where }: { where: "queue" | "dispatch" }) {
  useApp();
  const [pinRm, setPinRm] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState<Set<string>>(() => new Set());
  const [, force] = useState(0);
  const id = where === "queue" ? "pins-q" : "pins-d";
  const mgr = isMgr() && S.canWrite, list: any[] = pinsFor(where), hidden = pinsHidden();

  const newPin = () => openDialog({ kind: "pin", id: null });
  if (!list.length) {
    return (
      <div id={id} className="pins">
        {mgr && S.loaded ? <div className="pin-add"><Icon name="tack" /><span>Nothing pinned.</span><button className="linkbtn" data-act="pin-new" onClick={newPin}>Pin a message for the team</button></div> : null}
      </div>
    );
  }

  const live = list.filter((p) => !p.expired).length;
  const toggleHide = () => {
    try { localStorage.setItem("helpdesk.pinsHidden", localStorage.getItem("helpdesk.pinsHidden") === "1" ? "0" : "1"); } catch (e) { /* no storage */ }
    force((x) => x + 1);
  };
  const toggleMore = (pid: string) => setPinOpen((s) => { const n = new Set(s); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; });

  const card = (p: any) => {
    const long = (p.text || "").length > 260 || (p.text || "").split("\n").length > 5, open = pinOpen.has(p.id);
    return (
      <article key={p.id} className={"pin t-" + (p.tone || "note") + (p.expired ? " expired" : "") + (open ? " open" : "")}>
        <div className="ph"><b>{p.title || ""}</b>
          {mgr ? <span className="acts">{pinRm === p.id
            ? <><span className="muted" style={{ fontSize: 12.5 }}>Unpin?</span>
              <button className="linkbtn" data-act="pin-rm-yes" data-id={p.id} onClick={() => { setPinRm(null); removePin(p.id); }}>Yes</button>
              <button className="linkbtn" data-act="pin-rm-no" onClick={() => setPinRm(null)}>No</button></>
            : <><button className="linkbtn" data-act="pin-edit" data-id={p.id} onClick={() => openDialog({ kind: "pin", id: p.id })}>Edit</button>
              <button className="linkbtn" data-act="pin-rm" data-id={p.id} onClick={() => setPinRm(p.id)}>Unpin</button></>}
          </span> : null}
        </div>
        <div className="tx" dangerouslySetInnerHTML={{ __html: linkify(esc(p.text || "")) }} />
        {long ? <button className="linkbtn" style={{ alignSelf: "flex-start", fontSize: 12.5 }} data-act="pin-more" data-id={p.id} onClick={() => toggleMore(p.id)}>{open ? "Show less" : "Show more"}</button> : null}
        <div className="pm">{p.by || p.byLabel ? <Person uid={p.by} label={p.byLabel} size={16} /> : null}<span>{rel(p.updatedAt || p.createdAt)}</span><span className="sp" />
          {p.expired ? <span className="pill">Expired</span> : p.until ? <span>Until {shortDate(new Date(p.until).getTime())}</span> : null}</div>
      </article>
    );
  };

  return (
    <div id={id} className="pins">
      <div className="pins-h"><span className="t"><Icon name="tack" />Pinned <span className="num">{live}</span></span><span className="sp" />
        {mgr ? <button className="btn" style={{ height: 30 }} data-act="pin-new" onClick={newPin}><Icon name="plus" />Pin a message</button> : null}
        <button className="linkbtn" data-act="pin-hide" onClick={toggleHide}>{hidden ? "Show" : "Hide"}</button></div>
      {hidden ? null : <div className="pin-grid">{list.map(card)}</div>}
    </div>
  );
}
