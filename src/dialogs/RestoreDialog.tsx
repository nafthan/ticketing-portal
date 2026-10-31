import { useState } from "react";
import { svc, closeDialog } from "../core/state.ts";
import { BK_COLS, BK_NAMES } from "../core/constants.ts";
import { abs } from "../core/format.ts";
import { writeFailed } from "../core/data.ts";
import { runRestore } from "../core/backup.ts";
import { Dialog, Icon } from "../ui/index.tsx";

/** The restore dialog opened by readRestore(file): what's in the backup, and the Restore button. */
export function RestoreDialog({ data }: { data: any }) {
  const d = data, C = d.collections || {};
  const cnt = (k: string) => (C[k] && typeof C[k] === "object" ? Object.keys(C[k]).length : 0);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);

  async function go() {
    setBusy(true);
    try { await runRestore(d, (done: number, total: number) => setProg({ done, total })); }
    catch (e) { writeFailed(e); setBusy(false); }
  }

  return (
    <Dialog id="bk" className="dlg mid" labelledBy="bk-h" onClose={closeDialog}>
      <div className="d-top"><span className="lbl" id="bk-k">Restore</span><button className="x" data-act="bk-cancel" aria-label="Close" onClick={closeDialog}><Icon name="x" /></button></div>
      <h2 id="bk-h">Restore from backup</h2>
      <div id="bk-body">
        <p className="muted">{"Made " + abs(d.exportedAt || "") + (d.exportedBy ? " by " + d.exportedBy : "") + (d.app ? ", helpdesk " + d.app : "") + "."}</p>
        <div className="imp-sum">
          {(BK_COLS as string[]).filter((k) => cnt(k) && (svc.db || !["requests", "decisions"].includes(k))).map((k) => <span className="pill" key={k}>{cnt(k) + " " + (BK_NAMES as any)[k]}</span>)}
        </div>
        <div className="secnote" style={{ marginTop: 12 }}><b>Before you restore</b>Records in the file replace ones with the same ID here, and everything else here stays. If you're not sure, download a backup of what's here first.</div>
        <div className="bk-prog" id="bk-prog" hidden={!prog}><i style={prog ? { width: Math.round(prog.done * 100 / Math.max(1, prog.total)) + "%" } : undefined} /></div>
      </div>
      <div className="err" id="bk-err">{prog ? "Restoring " + prog.done + " of " + prog.total : ""}</div>
      <div className="actions" style={{ marginTop: 18 }} id="bk-acts">
        <button className="btn" data-act="bk-cancel" onClick={closeDialog}>Cancel</button>
        <button className="btn primary" data-act="bk-go" disabled={busy} onClick={go}>Restore</button>
      </div>
    </Dialog>
  );
}
