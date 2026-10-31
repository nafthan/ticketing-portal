import { useState } from "react";
import { S } from "../../core/state.ts";
import { SEV, DAYS, TZS } from "../../core/constants.ts";
import { wsSave } from "../../core/config.ts";
import { useApp, Options, Sev } from "../../ui/index.tsx";
import { useForm } from "./shared.tsx";

/** adHours() and wsSave(): time zone, working days and hours, holidays, SLA targets. */
export function Hours() {
  useApp();
  const c = S.cfg, sevs = Object.keys(SEV);
  const [f, set] = useForm("hours" + S.cfgVer, () => {
    const o: Record<string, any> = { "ws-tz": c.tz, days: c.days.slice(), "ws-start": c.start, "ws-end": c.end, "ws-hol": c.holidays.join("\n") };
    for (const k of sevs) { o["ws-h-" + k] = String((c.targets as any)[k].hours); o["ws-a-" + k] = !!(c.targets as any)[k].always; }
    return o;
  });
  const [err, setErr] = useState("");
  const days: number[] = f.days;
  const tzList = (TZS as string[]).includes(c.tz) ? (TZS as string[]) : [c.tz].concat(TZS as string[]);

  async function save() {
    setErr("");
    const targets: Record<string, { hours: any; always: boolean }> = {};
    for (const k of sevs) targets[k] = { hours: f["ws-h-" + k], always: !!f["ws-a-" + k] };
    const err = await wsSave({ tz: f["ws-tz"], days: [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)), start: f["ws-start"], end: f["ws-end"], holidays: f["ws-hol"], targets });
    if (err) setErr(err);
  }

  return (
    <div className="card adcard" style={{ maxWidth: 720 }}>
      <div className="form" style={{ marginTop: 0 }}>
        <label className="full"><span className="lbl">Time zone for working hours</span><select className="field" id="ws-tz" value={f["ws-tz"]} onChange={(e) => set("ws-tz", e.target.value)}><Options list={tzList} /></select></label>
        <div className="full"><span className="lbl" style={{ display: "block", marginBottom: 6 }}>Working days</span>
          <div className="daypick">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} data-act="ws-day" data-d={d} aria-pressed={days.includes(d)}
                onClick={() => set("days", days.includes(d) ? days.filter((x) => x !== d) : days.concat([d]))}>{DAYS[d]}</button>
            ))}
          </div>
        </div>
        <label><span className="lbl">Day starts</span><input className="field" type="time" id="ws-start" value={f["ws-start"]} onChange={(e) => set("ws-start", e.target.value)} /></label>
        <label><span className="lbl">Day ends</span><input className="field" type="time" id="ws-end" value={f["ws-end"]} onChange={(e) => set("ws-end", e.target.value)} /></label>
        <label className="full"><span className="lbl">Bank holidays, one date per line (YYYY-MM-DD)</span><textarea className="field" id="ws-hol" rows={4} value={f["ws-hol"]} onChange={(e) => set("ws-hol", e.target.value)} /></label>
        <div className="full"><span className="lbl" style={{ display: "block", marginBottom: 6 }}>Default resolution targets</span>
          {sevs.map((k) => (
            <div key={k} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "6px 0" }}>
              <Sev k={k} /><span style={{ flex: 1 }} />
              <input className="field" style={{ width: 80 }} inputMode="decimal" id={"ws-h-" + k} aria-label={k + " target hours"} value={f["ws-h-" + k]} onChange={(e) => set("ws-h-" + k, e.target.value)} />
              <span className="muted">hours</span>
              <label className="check"><input type="checkbox" id={"ws-a-" + k} checked={!!f["ws-a-" + k]} onChange={(e) => set("ws-a-" + k, e.target.checked)} />Around the clock</label>
            </div>
          ))}
          <p className="muted" style={{ fontSize: "12.5px", marginTop: 6 }}>Targets count working time unless set to run around the clock. The clock pauses while a ticket is pending. A customer's own targets or 24/7 plan override these.</p>
        </div>
        <div className="full err" id="ws-err">{err}</div>
        <div className="full actions"><button className="btn primary" data-act="ws-save" onClick={save}>Save hours and targets</button></div>
      </div>
    </div>
  );
}
