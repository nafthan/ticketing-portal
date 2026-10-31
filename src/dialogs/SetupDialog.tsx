/* First-run setup (#su: maybeSetup, setupSave, setupSkip). Opened by maybeSetup() for a manager on an empty helpdesk. */
import { useState } from "react";
import { S, ref, closeDialog, setView } from "../core/state.ts";
import { DAYS, TZS } from "../core/constants.ts";
import { loadDemo } from "../core/data.ts";
import { setupSave, setupSkip } from "../core/setup.ts";
import { useApp, Dialog, Icon, Mascot } from "../ui/index.tsx";

export function SetupDialog() {
  useApp();
  const [init] = useState(() => {
    const c = S.cfg, guess = Intl.DateTimeFormat().resolvedOptions().timeZone || c.tz;
    return { c, guess, tzs: [...new Set([guess].concat(TZS as string[]))] };
  });
  const c = init.c;
  const [name, setName] = useState(c.name);
  const [prefix, setPrefix] = useState(c.idPrefix);
  const [prev, setPrev] = useState(c.idPrefix + "-7K2QM");
  const [teams, setTeams] = useState(c.teams.join("\n"));
  const [cats, setCats] = useState(c.categories.join("\n"));
  const [tz, setTz] = useState(init.guess);
  const [start, setStart] = useState(c.start);
  const [end, setEnd] = useState(c.end);
  const [days, setDays] = useState<number[]>(() => c.days.slice());
  const [err, setErr] = useState("");

  const skip = () => { setupSkip(); closeDialog(); };
  const save = async () => {
    setErr("");
    /* raw field values, as the single-file edition reads them; setupSave trims, splits the lines and validates */
    const e = await setupSave({ name, prefix, teams, cats, tz, start, end, days: [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)) });
    if (e) setErr(e);
    else if (S.dialog && S.dialog.kind === "setup") closeDialog();
  };
  const toggleDay = (d: number) => setDays((l) => (l.includes(d) ? l.filter((x) => x !== d) : l.concat([d])));

  return (
    <Dialog id="su" className="dlg mid" labelledBy="su-h" onClose={closeDialog}>
      <div className="d-top"><span className="lbl">Welcome</span><button className="x" data-act="su-skip" aria-label="Close" onClick={skip}><Icon name="x" /></button></div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 6 }}><span className="su-m" id="su-m"><Mascot mood="party" live /></span><h2 id="su-h" style={{ margin: 0 }}>Let's set up your helpdesk</h2></div>
      <p className="muted">A few basics so the first tickets land in the right place. You can change all of this later in Admin.</p>
      <div className="form" style={{ marginTop: 14 }}>
        <label><span className="lbl">Helpdesk name</span><input className="field" id="su-name" maxLength={40} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label><span className="lbl">Ticket ID prefix</span><input className="field" id="su-prefix" maxLength={6} autoComplete="off" value={prefix}
          onChange={(e) => { setPrefix(e.target.value); setPrev((e.target.value.trim() || "?").toUpperCase() + "-7K2QM"); }} />
          <span className="muted" style={{ fontSize: 12.5 }}>Tickets look like <span className="tid" id="su-prev">{prev}</span></span></label>
        <label><span className="lbl">Teams, one per line</span><textarea className="field" id="su-teams" rows={5} value={teams} onChange={(e) => setTeams(e.target.value)} /></label>
        <label><span className="lbl">Categories, one per line</span><textarea className="field" id="su-cats" rows={5} value={cats} onChange={(e) => setCats(e.target.value)} /></label>
        <label><span className="lbl">Time zone</span><select className="field" id="su-tz" value={tz} onChange={(e) => setTz(e.target.value)}>
          {init.tzs.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}</select></label>
        <div><span className="lbl" style={{ display: "block", marginBottom: 6 }}>Working hours</span><div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="field" type="time" id="su-start" style={{ width: 120 }} aria-label="Start" value={start} onChange={(e) => setStart(e.target.value)} /><span className="muted">to</span>
          <input className="field" type="time" id="su-end" style={{ width: 120 }} aria-label="End" value={end} onChange={(e) => setEnd(e.target.value)} /></div></div>
        <div className="full"><span className="lbl" style={{ display: "block", marginBottom: 6 }}>Working days</span><div className="daypick" id="su-days">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => <button key={d} type="button" data-act="su-day" data-d={d} aria-pressed={days.includes(d)} onClick={() => toggleDay(d)}>{DAYS[d]}</button>)}
        </div></div>
        <div className="full err" id="su-err">{err}</div>
      </div>
      <div className="actions" style={{ marginTop: 18, justifyContent: "space-between", flexWrap: "wrap" }}>
        <span style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <button className="linkbtn" data-act="su-restore" onClick={() => { skip(); S.adTab = "access"; setView("admin"); }}>Restore a backup instead</button>
          <button className="linkbtn" data-act="su-sample" id="su-sample" hidden={!!ref.db} onClick={() => { skip(); loadDemo(); }}>Explore with sample data</button>
        </span>
        <span style={{ display: "flex", gap: 10 }}>
          <button className="btn" data-act="su-skip" onClick={skip}>Skip for now</button>
          <button className="btn primary" data-act="su-save" onClick={save}>Save and start</button>
        </span>
      </div>
    </Dialog>
  );
}
