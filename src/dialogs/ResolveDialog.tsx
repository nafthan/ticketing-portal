/*
 * Resolve or close with a note and/or time (#rs): openResolve and
 * submitResolve in the single-file edition.
 */
import { useEffect, useRef, useState } from "react";
import { S, closeDialog } from "../core/state.ts";
import { parseMin } from "../core/format.ts";
import { noteMins, submitResolve } from "../core/tickets.ts";
import { useApp, Dialog, Icon } from "../ui/index.tsx";

export function ResolveDialog({ id, to }: { id: string; to: "resolved" | "closed" }) {
  useApp();
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [mins, setMins] = useState("");
  const [billable, setBillable] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const tRef = useRef<HTMLTextAreaElement>(null), mRef = useRef<HTMLInputElement>(null);
  useEffect(() => { tRef.current?.focus(); }, []);

  const t = S.byId.get(id);
  if (!t) return null;
  const R = S.cfg.rules, needTime = R.timeToResolve && !noteMins(t)[0], req: string[] = [];
  if (R.noteToResolve) req.push("a resolution note");
  if (needTime) req.push("the time spent");
  const closing = to === "closed";

  const go = async () => {
    setBusy(true);
    const e = await submitResolve(id, to, { text: text.trim(), internal, minutes: parseMin(mins), billable });
    setBusy(false);
    if (e) {
      setErr(e);
      (e === "Add a resolution note." ? tRef.current : mRef.current)?.focus();
      return;
    }
    if (S.dialog && S.dialog.kind === "resolve") closeDialog();
  };

  return (
    <Dialog id="rs" className="dlg narrow" labelledBy="rs-h" onClose={closeDialog}>
      <div className="d-top"><span className="lbl" id="rs-id">{t.id}</span>
        <button className="x" data-act="rs-cancel" aria-label="Close" onClick={closeDialog}><Icon name="x" /></button>
      </div>
      <h2 id="rs-h">{closing ? "Close ticket" : "Resolve ticket"}</h2>
      <p className="muted" id="rs-sub">{"Your managers ask for " + req.join(" and ") + " before a ticket is " + (closing ? "closed" : "resolved") + "."}</p>
      <div className="form" style={{ gridTemplateColumns: "1fr" }}>
        <label><span className="lbl">Resolution note</span>
          <textarea ref={tRef} className="field" id="rs-t" rows={4} maxLength={6000} placeholder="What fixed it, and anything the customer should know"
            value={text} onChange={(e) => setText(e.target.value)} /></label>
        <label className="check"><input type="checkbox" id="rs-i" checked={internal} onChange={(e) => setInternal(e.target.checked)} />Internal only</label>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <input ref={mRef} className="field" id="rs-m" style={{ width: 180 }} placeholder="Time spent, e.g. 30m" aria-label="Time spent" autoComplete="off"
            value={mins} onChange={(e) => setMins(e.target.value)} />
          <label className="check"><input type="checkbox" id="rs-b" checked={billable} onChange={(e) => setBillable(e.target.checked)} />Billable</label>
        </div>
        <div className="err" id="rs-err">{err}</div>
        <div className="actions">
          <button className="btn" data-act="rs-cancel" onClick={closeDialog}>Cancel</button>
          <button className="btn primary" data-act="rs-go" id="rs-go" disabled={busy} onClick={go}>{closing ? "Close" : "Resolve"}</button>
        </div>
      </div>
    </Dialog>
  );
}
