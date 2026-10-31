/* Pin or edit a message for the Queue and Dispatch (#pin: openPin and savePin). */
import { useEffect, useRef, useState } from "react";
import { S, closeDialog } from "../core/state.ts";
import { toLocalInput } from "../core/format.ts";
import { isMgr } from "../core/people.ts";
import { savePin } from "../core/pins.ts";
import { useApp, Dialog, Icon } from "../ui/index.tsx";

export function PinDialog({ id }: { id: string | null }) {
  useApp();
  const [p] = useState(() => (id ? S.pins.find((x) => x.id === id) || null : null));
  const [title, setTitle] = useState(p ? p.title || "" : "");
  const [text, setText] = useState(p ? p.text || "" : "");
  const [tone, setTone] = useState<string>(p ? p.tone || "note" : "note");
  const [show, setShow] = useState<string>(p ? p.show || "both" : "both");
  const [until, setUntil] = useState(p && p.until ? toLocalInput(p.until) : "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null), textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => { const el = p ? textRef.current : titleRef.current; if (el) el.focus(); }, 30);
    return () => clearTimeout(t);
  }, []);

  if (!isMgr() || !S.canWrite) return null;

  const save = async () => {
    setErr("");
    setBusy(true);
    try {
      const e = await savePin(p ? p.id : null, { title, text, tone, show, until });
      if (e) {
        setErr(e);
        if (!text.trim() && textRef.current) textRef.current.focus();
      } else if (S.dialog && S.dialog.kind === "pin") closeDialog();
    } finally { setBusy(false); }
  };

  return (
    <Dialog id="pin" className="dlg mid" labelledBy="pin-h" onClose={closeDialog}>
      <div className="d-top"><span className="lbl">Pinned message</span><button className="x" data-act="pin-cancel" aria-label="Close" onClick={closeDialog}><Icon name="x" /></button></div>
      <h2 id="pin-h">{p ? "Edit pinned message" : "Pin a message"}</h2>
      <p className="muted">Pinned messages stay at the top of the Queue or Dispatch until you unpin them. For something urgent that has to be on every page, post an announcement in Admin, General instead.</p>
      <div className="form" style={{ marginTop: 14 }}>
        <label className="full"><span className="lbl">Title (optional)</span><input className="field" id="pn-title" ref={titleRef} maxLength={80} autoComplete="off" placeholder="e.g. Acme on-call number" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="full"><span className="lbl">Message</span><textarea className="field" id="pn-text" ref={textRef} rows={5} maxLength={1000} placeholder="What the team needs to know. Links are clickable." value={text} onChange={(e) => setText(e.target.value)} />
          <span className="muted" style={{ fontSize: 12.5 }} id="pn-count">{text.length > 800 ? (1000 - text.length) + " characters left" : ""}</span></label>
        <label><span className="lbl">Style</span><select className="field" id="pn-tone" value={tone} onChange={(e) => setTone(e.target.value)}><option value="note">Note</option><option value="info">Information</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label>
        <label><span className="lbl">Show on</span><select className="field" id="pn-show" value={show} onChange={(e) => setShow(e.target.value)}><option value="both">Queue and Dispatch</option><option value="queue">Queue only</option><option value="dispatch">Dispatch only</option></select></label>
        <label className="full"><span className="lbl">Unpin automatically (optional)</span><input className="field" type="datetime-local" id="pn-until" style={{ maxWidth: 260 }} value={until} onChange={(e) => setUntil(e.target.value)} /></label>
        <div className="full err" id="pn-err">{err}</div>
      </div>
      <div className="actions" style={{ marginTop: 18 }}>
        <button className="btn" data-act="pin-cancel" onClick={closeDialog}>Cancel</button>
        <button className="btn primary" data-act="pin-save" id="pn-save" disabled={busy} onClick={save}>{p ? "Save" : "Pin it"}</button>
      </div>
    </Dialog>
  );
}
