/*
 * Share to Teams (#sh): renderShare, openShare and copyShare in the
 * single-file edition.
 */
import { useRef, useState } from "react";
import { S, closeDialog } from "../core/state.ts";
import { SEV, ST_LABEL } from "../core/constants.ts";
import { isMgr } from "../core/people.ts";
import { logEvent } from "../core/data.ts";
import { ticketLink, sharePlain, copyShare } from "../core/share.ts";
import { useApp, Dialog, Icon } from "../ui/index.tsx";

export function ShareDialog({ id }: { id: string }) {
  useApp();
  const [desc, setDesc] = useState(true);
  const [note, setNote] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const t = S.byId.get(id);
  if (!t) return null;

  const inc = { desc, note };
  const link = ticketLink(t);
  const teamsHref = link
    ? "https://teams.microsoft.com/share?href=" + encodeURIComponent(link) + "&msgText=" +
      encodeURIComponent((t.id + ": " + t.subject + " (" + t.severity + " " + (SEV as any)[t.severity].label + ", " + ((ST_LABEL as any)[t.status] || t.status) + ")").slice(0, 300)) + "&preview=true"
    : undefined;
  const hint = link ? "" : isMgr()
    ? "Add the link people open the helpdesk at, under Admin, General, to share to Teams. You can still copy the message."
    : "A manager needs to add the helpdesk's link under Admin, General before tickets can be shared to Teams. You can still copy the message.";

  const copy = async () => {
    let ok = false;
    try { ok = !!(await copyShare(t, inc)); } catch { ok = false; }
    if (!ok) {
      // Last resort, as before: copy the selected text box.
      const el = ta.current;
      try { if (el) { el.focus(); el.select(); ok = document.execCommand("copy"); } } catch { ok = false; }
      if (ok) logEvent({ type: "share", ref: t.id, detail: "Copied for Teams" });
    }
    if (ok) setCopyMsg("Copied. Paste it into any Teams chat.");
    else { const el = ta.current; if (el) { el.focus(); el.select(); } setCopyMsg("Your browser blocked copying. The message is selected, so press Ctrl+C (or Cmd+C) to copy it."); }
  };

  return (
    <Dialog id="sh" className="dlg narrow" labelledBy="sh-h" onClose={closeDialog}>
      <div className="d-top"><span className="lbl" id="sh-id">{t.id}</span>
        <button className="x" data-act="sh-close" aria-label="Close" onClick={closeDialog}><Icon name="x" /></button>
      </div>
      <h2 id="sh-h">Share to Teams</h2>
      <p className="muted">Choose what to include, then open Teams to pick a chat or channel. Or copy the message and paste it anywhere.</p>
      <div className="sh-opts">
        <label className="check"><input type="checkbox" id="sh-desc" checked={desc} onChange={(e) => { setDesc(e.target.checked); setCopyMsg(null); }} />Description</label>
        <label className="check"><input type="checkbox" id="sh-note" checked={note} onChange={(e) => { setNote(e.target.checked); setCopyMsg(null); }} />Latest customer-visible note</label>
      </div>
      <textarea ref={ta} className="field" id="sh-text" readOnly aria-label="Message to share" value={sharePlain(t, inc)} />
      <p className="muted" id="sh-msg" style={{ fontSize: 12.5, minHeight: 18, marginTop: 8 }} aria-live="polite">{copyMsg ?? hint}</p>
      <div className="actions" style={{ marginTop: 8 }}>
        <button className="btn" data-act="sh-copy" onClick={copy}>Copy message</button>
        <a className="btn teams" id="sh-teams" data-act="sh-teams" target="_blank" rel="noopener noreferrer" href={teamsHref}
          aria-disabled={link ? undefined : "true"} tabIndex={link ? undefined : -1}
          onClick={(e) => {
            if (!link) { e.preventDefault(); return; }
            logEvent({ type: "share", ref: t.id, detail: "Opened Share to Teams" });
          }}><Icon name="teams" />Share to Teams</a>
      </div>
    </Dialog>
  );
}
