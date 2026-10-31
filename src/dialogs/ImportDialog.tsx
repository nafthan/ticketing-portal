import { Fragment, useState } from "react";
import { closeDialog } from "../core/state.ts";
import { writeFailed } from "../core/data.ts";
import { runImport } from "../core/csvimport.ts";
import { Dialog, Icon } from "../ui/index.tsx";

/** showImport(): preview of a CSV import (from planCustomers/planTickets) and the Import button. */
export function ImportDialog({ plan }: { plan: any }) {
  const I = plan, count = I.kind === "customers" ? I.groups.length : I.rows.length;
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);
  const unknown: string[] = I.unknown || [], warn: string[] = I.warn || [];

  async function go() {
    setBusy(true);
    try { await runImport(I, (done: number, total: number) => setProg({ done, total })); }
    catch (e) { writeFailed(e); setBusy(false); }
  }

  return (
    <Dialog id="bk" className="dlg mid" labelledBy="bk-h" onClose={closeDialog}>
      <div className="d-top"><span className="lbl" id="bk-k">Import</span><button className="x" data-act="bk-cancel" aria-label="Close" onClick={closeDialog}><Icon name="x" /></button></div>
      <h2 id="bk-h">{I.kind === "customers" ? "Import customers and contacts" : "Import tickets"}</h2>
      <div id="bk-body">
        <p className="muted">From <b>{I.file}</b>. Nothing is saved until you choose Import.</p>
        <div className="imp-sum">
          {I.sum.filter((x: any[]) => x[0]).map((x: any[], i: number) => <span className="pill" key={i}>{x[0] + " " + (x[0] === 1 ? x[1] : (x[2] || x[1] + "s"))}</span>)}
          {I.skipped ? <span className="pill">{I.skipped} skipped</span> : null}
        </div>
        {I.preview.rows.length
          ? <>
              <div className="imp-tbl"><table>
                <thead><tr>{I.preview.head.map((h: string, i: number) => <th key={i}>{h}</th>)}</tr></thead>
                <tbody>{I.preview.rows.map((r: string[], i: number) => <tr key={i}>{r.map((v, j) => <td className="wrap" key={j}>{v}</td>)}</tr>)}</tbody>
              </table></div>
              {count > 50 ? <p className="muted" style={{ fontSize: "12.5px", marginTop: 6 }}>Showing the first 50 of {count}.</p> : null}
            </>
          : null}
        {unknown.length ? <div className="imp-warn">Columns ignored: {unknown.join(", ")}. Rename them to match the template if you need them.</div> : null}
        {warn.length
          ? <div className="imp-warn">
              {warn.slice(0, 12).map((w, i) => <Fragment key={i}>{i ? <br /> : null}{w}</Fragment>)}
              {warn.length > 12 ? <><br />…and {warn.length - 12} more.</> : null}
            </div>
          : null}
        <div className="bk-prog" id="bk-prog" hidden={!prog}><i style={prog ? { width: Math.round(prog.done * 100 / Math.max(1, prog.total)) + "%" } : undefined} /></div>
      </div>
      <div className="err" id="bk-err">{prog ? "Saving " + prog.done + " of " + prog.total : ""}</div>
      <div className="actions" style={{ marginTop: 18 }} id="bk-acts">
        <button className="btn" data-act="im-cancel" onClick={closeDialog}>Cancel</button>
        <button className="btn primary" data-act="im-go" disabled={!count || busy} onClick={go}>Import {count}</button>
      </div>
    </Dialog>
  );
}
