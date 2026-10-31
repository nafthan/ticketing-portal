import type { ReactNode } from "react";
import { S, svc, commit } from "../core/state.ts";
import { SEV, CHANNELS, STATUSES, ST_LABEL, ACTIVE } from "../core/constants.ts";
import { dur, fmtMin, median, pad } from "../core/format.ts";
import { custName } from "../core/people.ts";
import { sla } from "../core/hours.ts";
import { repSet, tally } from "../core/reports.ts";
import { exportTickets, exportTime } from "../core/exports.ts";
import type { Ticket } from "../core/types.ts";
import { useApp, Sev, ChanIcon, Logo, Person } from "../ui/index.tsx";
import { drill } from "./admin/shared.tsx";

interface Bar { html: ReactNode; n: number; hot?: boolean; drill?: [string, string] }

/** barList(rows, total, fmt) */
function BarList({ rows, total, fmt }: { rows: Bar[]; total: number; fmt?: (n: number) => string }) {
  if (!rows.length) return <p className="muted">No tickets in this period.</p>;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <>
      {rows.map((r, i) => (
        <div className="bl" key={i}>
          <span className="lab">{r.drill
            ? <button className="linkbtn" style={{ borderBottomColor: "var(--line)", fontWeight: 400 }} data-act="drill" data-k={r.drill[0]} data-val={r.drill[1]} onClick={() => drill(r.drill![0], r.drill![1])}>{r.html}</button>
            : r.html}</span>
          <span className="track"><span className={"fill" + (r.hot ? " hot" : "")} style={{ width: (r.n / max * 100).toFixed(1) + "%" }} /></span>
          <span className="num cnt">{fmt ? fmt(r.n) : r.n}</span>
          <span className="num pct">{(total ? Math.round(r.n / total * 100) : 0) + "%"}</span>
        </div>
      ))}
    </>
  );
}

/** volumeChart(): tickets opened and resolved per day or week. */
function VolumeChart() {
  const r = S.rep.range, now = Date.now();
  const all = S.tickets.filter((t) => !S.rep.team || t.team === S.rep.team);
  let days = r;
  if (!r) { const first = Math.min(now, ...all.map((t) => new Date(t.createdAt).getTime())); days = Math.max(7, Math.ceil((now - first) / 864e5) + 1); }
  const step = days > 45 ? 7 : 1, n = Math.ceil(days / step);
  const end = new Date(); end.setHours(24, 0, 0, 0);
  const e0 = end.getTime(), s0 = e0 - n * step * 864e5;
  const c = new Array(n).fill(0), d = new Array(n).fill(0);
  for (const t of all) {
    let i = Math.floor((new Date(t.createdAt).getTime() - s0) / (step * 864e5)); if (i >= 0 && i < n) c[i]++;
    if (t.resolvedAt) { i = Math.floor((new Date(t.resolvedAt).getTime() - s0) / (step * 864e5)); if (i >= 0 && i < n) d[i]++; }
  }
  const raw = Math.max(...c, ...d, 1), max = raw <= 4 ? 4 : Math.ceil(raw / 4) * 4;
  const X = (i: number) => (n === 1 ? 500 : i / (n - 1) * 1000), Y = (v: number) => 200 - v / max * 200;
  const line = (a: number[], col: string) => (
    <polyline fill="none" stroke={col} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
      points={a.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ")} />
  );
  const lab = (i: number) => { const dt = new Date(s0 + i * step * 864e5); return pad(dt.getDate()) + " " + dt.toLocaleString("en-GB", { month: "short" }); };
  return (
    <>
      <div className="chart" role="img" aria-label={"Tickets opened and resolved per " + (step > 1 ? "week" : "day")}>
        {[0, 1, 2, 3, 4].map((g) => <span key={g} className="y num" style={{ top: (g * 25) + "%" }}>{max - max / 4 * g}</span>)}
        <svg viewBox="0 0 1000 200" preserveAspectRatio="none">
          {[0, 1, 2, 3, 4].map((g) => <line key={g} x1="0" x2="1000" y1={g * 50} y2={g * 50} stroke="var(--line)" strokeWidth="1" strokeDasharray={g < 4 ? "3 5" : undefined} vectorEffect="non-scaling-stroke" />)}
          {line(d, "var(--good)")}
          {line(c, "var(--accent)")}
          {c.map((v, i) => (
            <rect key={i} x={(X(i) - 500 / n).toFixed(1)} y="0" width={(1000 / n).toFixed(1)} height="200" fill="transparent">
              <title>{lab(i) + (step > 1 ? " week" : "") + ": " + v + " opened, " + d[i] + " resolved"}</title>
            </rect>
          ))}
        </svg>
      </div>
      <div className="xlab num"><span>{lab(0)}</span><span>{lab(Math.floor((n - 1) / 2))}</span><span>{lab(n - 1)}</span></div>
    </>
  );
}

/** renderReports() */
export function Reports() {
  useApp();
  const set: Ticket[] = repSet(), total = set.length, done = set.filter((t) => t.resolvedAt);
  const times = done.map((t) => new Date(t.resolvedAt as string).getTime() - new Date(t.createdAt).getTime()), med = median(times);
  const met = done.filter((t) => sla(t).state === "met").length;
  const breachedOpen = set.filter((t) => sla(t).state === "breached").length;
  const tfrom = S.rep.range ? Date.now() - S.rep.range * 864e5 : 0;
  let tMin = 0, tBill = 0;
  const cMin = new Map<string, [number, number]>(), aMin = new Map<string, { m: number; n: any }>();
  for (const t of S.tickets) {
    if (S.rep.team && t.team !== S.rep.team) continue;
    for (const n of t.notes || []) {
      if (!((n.minutes as number) > 0) || new Date(n.at).getTime() < tfrom) continue;
      const mins = n.minutes as number;
      tMin += mins; if (n.billable) tBill += mins;
      const cn = custName(t), cv = cMin.get(cn) || [0, 0]; cv[0] += mins; if (n.billable) cv[1] += mins; cMin.set(cn, cv);
      const ak = n.by ? "u:" + n.by : "l:" + (n.byLabel || ""); const av = aMin.get(ak) || { m: 0, n }; av.m += mins; aMin.set(ak, av);
    }
  }
  const tcell = (nm: string) => { const v = cMin.get(nm); return v ? fmtMin(v[1]) + " / " + fmtMin(v[0]) : "–"; };
  const teamVal = S.cfg.teams.includes(S.rep.team) ? S.rep.team : "";

  const cm = new Map<string, any>();
  for (const t of set) {
    const c = cm.get(custName(t)) || { n: 0, open: 0, S1: 0, S2: 0, S3: 0, S4: 0, times: [] as number[], done: 0, met: 0 };
    c.n++; if (ACTIVE.has(t.status)) c.open++; c[t.severity] = (c[t.severity] || 0) + 1;
    if (t.resolvedAt) { c.done++; c.times.push(new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()); if (sla(t).state === "met") c.met++; }
    cm.set(custName(t), c);
  }
  const crow = [...cm.entries()].sort((a, b) => b[1].n - a[1].n), cmax = Math.max(1, ...crow.map((r) => r[1].n));
  const custTable = crow.length
    ? <div className="scroll-x"><table>
        <thead><tr><th style={{ paddingLeft: 20 }}>Customer</th><th>Tickets</th><th className="r">Active</th><th className="r">S1</th><th className="r">S2</th><th className="r">S3</th><th className="r">S4</th><th className="r">Median resolve</th><th className="r">Billable / total time</th><th className="r" style={{ paddingRight: 20 }}>SLA met</th></tr></thead>
        <tbody>
          {crow.map(([name, c]) => (
            <tr key={name}>
              <td style={{ paddingLeft: 20 }}><span className="person"><Logo c={S.custByName.get(name.toLowerCase())} name={name} size={26} />
                <button className="linkbtn" style={{ borderBottomColor: "var(--line)" }} data-act="drill" data-k="customer" data-val={name} onClick={() => drill("customer", name)}>{name}</button></span></td>
              <td><span className="minibar" style={{ width: (c.n / cmax * 120).toFixed(0) + "px" }} /><span className="num">{c.n}</span></td>
              <td className="r num">{c.open}</td><td className={"r num" + (c.S1 ? " breach" : " muted")}>{c.S1}</td><td className="r num">{c.S2}</td><td className="r num">{c.S3}</td><td className="r num">{c.S4}</td>
              <td className="r num">{c.times.length ? dur(median(c.times) as number) : "–"}</td><td className="r num">{tcell(name)}</td>
              <td className="r num" style={{ paddingRight: 20 }}>{c.done ? Math.round(c.met / c.done * 100) + "%" : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    : <p className="muted" style={{ padding: "0 20px 16px" }}>No tickets in this period.</p>;

  const chT: Map<any, number> = tally(set, (t: Ticket) => t.channel), sevT: Map<any, number> = tally(set, (t: Ticket) => t.severity), catT: Map<any, number> = tally(set, (t: Ticket) => t.category);
  const stT: Map<any, number> = tally(set, (t: Ticket) => t.status), teamT: Map<any, number> = tally(set, (t: Ticket) => t.team);
  const techT = new Map<string, { n: number; t: Ticket }>();
  for (const t of set) { const k = t.assigneeId ? "u:" + t.assigneeId : t.assigneeLabel ? "l:" + t.assigneeLabel : ""; const o = techT.get(k) || { n: 0, t }; o.n++; techT.set(k, o); }
  const sortD = (m: Map<any, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  const noChan = (chT.get(undefined) || 0) + (chT.get(null) || 0);

  return (
    <>
      <div className="pagehead">
        <div><h1>Reports</h1><p id="r-sub">{"Tickets opened " + (S.rep.range ? "in the last " + S.rep.range + " days" : "at any time") + (S.rep.team ? ", " + S.rep.team + " team" : "") + ". Select a customer, severity or category to see those tickets in the queue."}</p></div>
        <div className="toolbar" style={{ margin: 0 }}>
          <select className="field" id="r-range" aria-label="Period" value={String(S.rep.range)} onChange={(e) => { S.rep.range = +e.target.value; commit(); }}>
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="0">All time</option>
          </select>
          <select className="field" id="r-team" aria-label="Team" value={teamVal} onChange={(e) => { S.rep.team = e.target.value; commit(); }}>
            <option value="">All teams</option>{S.cfg.teams.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <button className="btn" data-act="export-time" id="r-export-time" hidden={!svc.downloads} onClick={() => exportTime()}>Export time</button>
          <button className="btn dark" data-act="export-tickets" id="r-export" hidden={!svc.downloads} onClick={() => exportTickets()}>Export CSV</button>
        </div>
      </div>
      <div className="tiles card" id="r-tiles">
        <div className="tile"><span className="lbl">Opened</span><span className="val">{total}</span></div>
        <div className="tile"><span className="lbl">Resolved</span><span className="val">{done.length}<small>{(total ? Math.round(done.length / total * 100) : 0) + "%"}</small></span></div>
        <div className="tile"><span className="lbl">Median time to resolve</span><span className="val">{med == null ? "–" : dur(med)}</span></div>
        <div className="tile"><span className="lbl">{breachedOpen ? <span className="dot hot" /> : null}SLA met</span><span className="val">{done.length ? Math.round(met / done.length * 100) + "%" : "–"}<small>{breachedOpen} active breached</small></span></div>
        <div className="tile"><span className="lbl">Billable time</span><span className="val">{fmtMin(tBill)}<small>of {fmtMin(tMin)}</small></span></div>
      </div>
      <div className="grid2" id="r-body">
        <div className="panel card full"><h3><span>Volume</span><span className="legend"><span><i style={{ background: "var(--accent)" }} />Opened</span><span><i style={{ background: "var(--good)" }} />Resolved</span></span></h3><VolumeChart /></div>
        <div className="panel card full flush"><h3>Tickets per customer</h3>{custTable}</div>
        <div className="panel card"><h3>By severity</h3>
          <BarList total={total} rows={Object.keys(SEV).filter((k) => sevT.get(k)).map((k) => ({ html: <Sev k={k} />, n: sevT.get(k) as number, hot: k === "S1", drill: ["sev", k] as [string, string] }))} />
          <h3 style={{ marginTop: 26 }}>By channel</h3>
          <BarList total={total} rows={Object.keys(CHANNELS).filter((k) => chT.get(k)).map((k): Bar => ({ html: <span className="person"><ChanIcon c={k} />{(CHANNELS as any)[k]}</span>, n: chT.get(k) as number }))
            .concat(noChan ? [{ html: <span className="muted">Not recorded</span>, n: noChan }] : [])} />
        </div>
        <div className="panel card"><h3>By status</h3>
          <BarList total={total} rows={(STATUSES as string[]).filter((k) => stT.get(k)).map((k) => ({ html: (ST_LABEL as any)[k], n: stT.get(k) as number, drill: ["status", k] as [string, string] }))} />
        </div>
        <div className="panel card"><h3>By category</h3>
          <BarList total={total} rows={sortD(catT).map(([k, n]) => ({ html: k, n, drill: ["category", k] as [string, string] }))} />
        </div>
        <div className="panel card"><h3>By team</h3>
          <BarList total={total} rows={sortD(teamT).map(([k, n]) => ({ html: k, n, drill: ["team", k] as [string, string] }))} />
          <h3 style={{ marginTop: 26 }}>By technician</h3>
          <BarList total={total} rows={[...techT.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, o]) => ({ html: k ? <Person uid={o.t.assigneeId} label={o.t.assigneeLabel} size={20} /> : <span className="muted">Unassigned</span>, n: o.n }))} />
          <h3 style={{ marginTop: 26 }}>Time logged by person</h3>
          <BarList total={tMin} fmt={fmtMin} rows={[...aMin.values()].sort((a, b) => b.m - a.m).map((o) => ({ html: <Person uid={o.n.by} label={o.n.byLabel || "Unknown"} size={20} />, n: o.m }))} />
        </div>
      </div>
    </>
  );
}
