import { useState } from "react";
import { S } from "../../core/state.ts";
import { rulesSave } from "../../core/config.ts";
import { useApp } from "../../ui/index.tsx";
import { useForm, focusId, Switch } from "./shared.tsx";

/** adRules() and rulesSave(). */
export function Rules() {
  useApp();
  const r = S.cfg.rules;
  const [f, set] = useForm("rules" + S.cfgVer, () => ({
    "r-note": !!r.noteToResolve, "r-time": !!r.timeToResolve, "r-shift": !!S.cfg.requireShift,
    "r-max": String(r.maxActive), "r-shiftmax": String(r.maxShiftHours), "r-soon": String(r.soonHours), "r-close": String(r.autoCloseDays), "r-grace": String(r.graceDays),
  }));
  const [err, setErr] = useState("");

  const num = (id: string, t: string, d: string, unit: string) => (
    <div className="lrow" style={{ gap: 12, borderTop: "1px solid var(--line)" }}>
      <span className="nm" style={{ display: "block", whiteSpace: "normal" }}><b style={{ fontWeight: 500 }}>{t}</b><br /><span className="muted" style={{ fontSize: 13 }}>{d}</span></span>
      <input className="field" id={id} inputMode="decimal" style={{ width: 76 }} aria-label={t} value={f[id]} onChange={(e) => set(id, e.target.value)} />
      <span className="muted" style={{ width: 46 }}>{unit}</span>
    </div>
  );
  const sw = (id: string, t: string, d: string) => <Switch id={id} on={!!f[id]} title={t} desc={d} onChange={(v) => set(id, v)} />;

  async function save() {
    setErr("");
    const err = await rulesSave({
      requireShift: !!f["r-shift"], noteToResolve: !!f["r-note"], timeToResolve: !!f["r-time"],
      maxActive: f["r-max"], maxShiftHours: f["r-shiftmax"], soonHours: f["r-soon"], autoCloseDays: f["r-close"], graceDays: f["r-grace"],
    });
    if (err) {
      setErr(err);
      const at: [string, string][] = [["Most active", "r-max"], ["Automatic clock-out", "r-shiftmax"], ["Due soon", "r-soon"], ["Closing resolved", "r-close"], ["The grace period", "r-grace"]];
      const hit = at.find(([p]) => err.startsWith(p));
      if (hit) focusId(hit[1]);
    }
  }

  return (
    <>
      <div className="adgrid">
        <div className="card adcard"><h3>Resolving tickets</h3>
          {sw("r-note", "Require a resolution note", "Anyone resolving or closing a ticket describes the fix first. It's saved as a note on the ticket.")}
          {sw("r-time", "Require time to be logged", "A ticket can't be resolved until some time has been logged against it.")}
        </div>
        <div className="card adcard"><h3>Shifts and workload</h3>
          {sw("r-shift", "Require clock-in to take tickets", "People can only take or be given tickets while clocked in.")}
          {num("r-max", "Most active tickets per agent", "Agents can't take more than this at once. Managers can still assign over it. 0 means no limit.", "tickets")}
          {num("r-shiftmax", "Clock out automatically after", "Catches forgotten clock-outs. Applied when that person or a manager has the page open. 0 means never.", "hours")}
        </div>
        <div className="card adcard"><h3>SLA and tidying up</h3>
          {num("r-soon", "Flag tickets as due soon within", "Controls the due-soon highlight, the My desk count and the queue filter.", "hours")}
          {num("r-close", "Close resolved tickets after", "Applied when a manager has the page open, and recorded in the audit log. 0 means never.", "days")}
          {num("r-grace", "Grace period after closing", "Closed tickets wait this long before closing for good, so they can still be reopened. 0 closes them straight away.", "days")}
        </div>
      </div>
      <div className="err" id="r-err" style={{ marginTop: 12 }}>{err}</div>
      <div className="actions" style={{ marginTop: 8 }}><button className="btn primary" data-act="r-save" onClick={save}>Save rules</button></div>
    </>
  );
}
