import { useState, type ChangeEvent } from "react";
import { S, commit } from "../../core/state.ts";
import { removeSamples } from "../../core/data.ts";
import { SAMPLE_DATA } from "../../core/constants.ts";
import { makeBackup, readRestore } from "../../core/backup.ts";
import { importTemplate, readImport } from "../../core/csvimport.ts";
import { exportTickets, exportTime, exportAudit, exportHistory } from "../../core/exports.ts";
import { useApp } from "../../ui/index.tsx";

/** adAccess(): roles, backup and restore, CSV import, exports and sample data. */
export function Access() {
  useApp();
  const [bkBusy, setBkBusy] = useState(false);
  const [smBusy, setSmBusy] = useState(false);
  const n = S.tickets.filter((t) => t.sample).length + S.customers.filter((c) => c.sample).length + S.staff.filter((m) => m.sample).length;
  const pick = (fn: (f: File) => void) => (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) fn(f); };
  const setConfirm = (v: boolean) => { S.confirmSample = v; commit(); };

  return (
    <>
      <div className="card adcard" style={{ marginBottom: 20 }}><h3>Who can do what</h3>
        <p className="muted">Roles come from your sign-in system, so there are no separate helpdesk accounts to manage. Whoever hosts the helpdesk maps people to these three roles.</p>
        <div className="roles">
          <div><b>Manager</b><span className="muted" style={{ fontSize: "12.5px" }}>Runs the helpdesk</span><ul><li>Everything agents can do</li><li>Assign and reassign tickets to anyone on shift</li><li>Clock others in or out</li><li>Change the team, lists, hours and SLA targets</li></ul></div>
          <div><b>Agent</b><span className="muted" style={{ fontSize: "12.5px" }}>Works tickets</span><ul><li>Clock in and out</li><li>Take unassigned tickets while on shift, and hand back their own</li><li>Work tickets, log time and notes</li><li>Manage customers and contacts</li></ul></div>
          <div><b>Viewer</b><span className="muted" style={{ fontSize: "12.5px" }}>Read only</span><ul><li>See the queue, reports and audit log</li><li>No changes</li></ul></div>
        </div>
      </div>
      <div className="adgrid" style={{ marginBottom: 20 }}>
        <div className="card adcard"><h3>Backup and restore</h3>
          <p className="muted">One file with every ticket, customer, agent, setting and audit entry. Keep one before upgrading, or use it to move to another server.</p>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn dark" data-act="bk-make" disabled={bkBusy} onClick={() => { setBkBusy(true); Promise.resolve(makeBackup()).finally(() => setBkBusy(false)); }}>Download full backup</button>
            <label className="btn" style={{ cursor: "pointer" }}>Restore from backup<input type="file" accept=".json,application/json" data-act-file="restore" hidden onChange={pick((f) => readRestore(f))} /></label>
          </div>
          <p className="muted" style={{ fontSize: "12.5px", marginTop: 10 }}>Restoring adds records and replaces ones with the same ID. Anything not in the file is left alone.</p>
        </div>
        <div className="card adcard"><h3>Import from a spreadsheet</h3>
          <p className="muted">Bring customers, contacts and old tickets across from another system as CSV. You'll see a preview before anything is saved.</p>
          <div className="lrow"><span className="nm" style={{ flex: 1 }}>Customers and contacts</span>
            <button className="linkbtn" data-act="imp-tpl" data-k="customers" onClick={() => importTemplate("customers")}>Template</button>
            <label className="btn" style={{ cursor: "pointer" }}>Choose CSV<input type="file" accept=".csv,text/csv" data-act-file="imp-customers" hidden onChange={pick((f) => readImport("customers", f))} /></label>
          </div>
          <div className="lrow"><span className="nm" style={{ flex: 1 }}>Tickets</span>
            <button className="linkbtn" data-act="imp-tpl" data-k="tickets" onClick={() => importTemplate("tickets")}>Template</button>
            <label className="btn" style={{ cursor: "pointer" }}>Choose CSV<input type="file" accept=".csv,text/csv" data-act-file="imp-tickets" hidden onChange={pick((f) => readImport("tickets", f))} /></label>
          </div>
        </div>
      </div>
      <div className="card adcard" style={{ marginBottom: 20 }}><h3>Export</h3><p className="muted">CSV files for reporting or billing.</p>
        <div className="actions" style={{ justifyContent: "flex-start" }}>
          <button className="btn" data-act="export-tickets" onClick={() => exportTickets()}>Tickets</button>
          <button className="btn" data-act="export-time" onClick={() => exportTime()}>Time entries</button>
          <button className="btn" data-act="export-audit" onClick={() => exportAudit()}>Audit log</button>
          <button className="btn" data-act="export-history" onClick={() => exportHistory()}>Closed tickets</button>
        </div>
      </div>
      {SAMPLE_DATA && n
        ? <div className="card adcard"><h3>Sample data</h3><p className="muted">{n} sample tickets, customers and team members are loaded. Removing them can't be undone.</p>
            <div className="actions">
              {S.confirmSample
                ? <><button className="btn dark" data-act="sample-yes" disabled={smBusy} onClick={() => { setSmBusy(true); Promise.resolve(removeSamples()).finally(() => setSmBusy(false)); }}>Remove sample data</button>
                    <button className="btn" data-act="sample-no" onClick={() => setConfirm(false)}>Keep it</button></>
                : <button className="btn" data-act="sample-ask" onClick={() => setConfirm(true)}>Remove sample data</button>}
            </div>
          </div>
        : null}
    </>
  );
}
