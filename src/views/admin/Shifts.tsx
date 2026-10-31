import { S } from "../../core/state.ts";
import { abs, dur, fmtMin, hm } from "../../core/format.ts";
import { setShift } from "../../core/tickets.ts";
import { useApp, Person, Who } from "../../ui/index.tsx";

/** adShifts(): who's on shift, hours this week and the shift log. */
export function Shifts() {
  useApp();
  const now = Date.now(), wk = now - 7 * 864e5, on = S.shifts.filter((x) => x.on);
  const log = S.events.filter((e) => e.type === "shift").sort((a, b) => (a.at < b.at ? 1 : -1));
  const tot = new Map<string, { m: number; e: any }>();
  for (const e of log) if (e.action === "out" && e.minutes && new Date(e.at).getTime() >= wk) {
    const k = e.target ? "u:" + e.target : "l:" + e.targetLabel;
    const o = tot.get(k) || { m: 0, e }; o.m += e.minutes; tot.set(k, o);
  }
  for (const x of on) {
    const k = x.uid ? "u:" + x.uid : "l:" + x.label;
    const o = tot.get(k) || { m: 0, e: { target: x.uid, targetLabel: x.label } };
    o.m += Math.max(0, Math.round((now - new Date(x.since as string).getTime()) / 6e4)); tot.set(k, o);
  }
  return (
    <>
      {S.cfg.requireShift ? null : <div className="note"><span>Clock-in isn't required right now, so anyone can take tickets at any time. You can change this under Rules.</span></div>}
      <div className="adgrid">
        <div className="card adcard"><h3>On shift now ({on.length})</h3>
          {on.length ? on.map((x) => (
            <div className="lrow" key={x.id}>
              <span className="nm"><Person uid={x.uid} label={x.label} size={24} /></span>
              <span className="ct">since {hm(x.since as string)}, {dur(now - new Date(x.since as string).getTime())}</span>
              <button className="btn" data-act="ad-shift" data-suid={x.uid || ""} data-label={x.label || ""} data-on="0" onClick={() => setShift(x.uid || null, x.label || null, false)}>Clock out</button>
            </div>
          )) : <p className="muted">Nobody is clocked in.</p>}
        </div>
        <div className="card adcard"><h3>Hours on shift, last 7 days</h3>
          {tot.size ? [...tot.entries()].sort((a, b) => b[1].m - a[1].m).map(([k, o]) => (
            <div className="lrow" key={k}><span className="nm"><Person uid={o.e.target} label={o.e.targetLabel} size={24} /></span><span className="num">{fmtMin(o.m)}</span></div>
          )) : <p className="muted">No shifts recorded yet.</p>}
        </div>
      </div>
      <h2 className="sec-h">Shift log</h2>
      <div className="card tablecard"><div className="scroll-x"><table>
        <thead><tr><th>Time</th><th>Person</th><th>Event</th><th>Length</th><th>Recorded by</th></tr></thead>
        <tbody>
          {log.length ? log.slice(0, 100).map((e, i) => (
            <tr key={(e.id || "") + e.at + i}>
              <td className="num muted">{abs(e.at)}</td>
              <td><Person uid={e.target} label={e.targetLabel} size={22} /></td>
              <td>{e.action === "in" ? "Clocked in" : "Clocked out"}</td>
              <td className="num">{e.minutes != null && e.action === "out" ? fmtMin(e.minutes) : ""}</td>
              <td className="muted">{e.auto ? "Automatic" : e.by && e.by === e.target ? "Themselves" : <Who uid={e.by} label={e.byLabel} />}</td>
            </tr>
          )) : <tr><td colSpan={5} className="muted">Clock-ins and clock-outs appear here.</td></tr>}
        </tbody>
      </table></div></div>
    </>
  );
}
