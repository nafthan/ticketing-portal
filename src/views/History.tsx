/*
 * Closed ticket history: renderHistory() and histBoard() in the single-file edition.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { S, P, ref, svc, commit } from "../core/state.ts";
import { abs, dur, fmtMin } from "../core/format.ts";
import { sla } from "../core/hours.ts";
import { custOf, custName, staffSorted, staffName, whoText } from "../core/people.ts";
import { openTicket } from "../core/tickets.ts";
import { histKey, histRows, loadOlderClosed } from "../core/history.ts";
import { exportHistory } from "../core/exports.ts";
import { setPref } from "../core/prefs.ts";
import { useApp, Icon, Mascot, Ava, Who, Person, Sev, StatusChip, CatIcon, ChanIcon, Logo, SlaText, Options } from "../ui/index.tsx";
import { HistCard, Snippet, type HistRow } from "../ui/TicketCard.tsx";

const month = (ms: number) => new Date(ms).toLocaleString("en-GB", { month: "long", year: "numeric" });

/** histBoard(shown, rows) */
function HistBoard({ shown, rows }: { shown: HistRow[]; rows: HistRow[] }) {
  const G = P.histGroup, m = new Map<string, HistRow[]>(), cnt = new Map<string, number>();
  const key = (r: HistRow) => G === "agent" ? histKey(r.t) : G === "category" ? (r.t.category || "Uncategorised") : G === "customer" ? (custName(r.t) || "No customer") : month(r.c.ms);
  for (const r of rows) { const k = key(r); cnt.set(k, (cnt.get(k) || 0) + 1); }
  for (const r of shown) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
  const cols = [...m.entries()];
  if (G !== "month") cols.sort((a, b) => (cnt.get(b[0])! - cnt.get(a[0])!) || String(a[0]).localeCompare(String(b[0])));
  return (
    <div className="board">
      {cols.map(([k, list]) => {
        let hd: ReactNode;
        if (G === "agent") {
          const t = list[0].t;
          hd = k === "none" ? <><span className="av" style={{ "--s": "28px" } as CSSProperties}><Icon name="user" /></span><b>Unassigned</b></>
            : <><Ava uid={t.assigneeId} label={t.assigneeLabel} size={28} /><b><Who uid={t.assigneeId} label={t.assigneeLabel} /></b></>;
        } else if (G === "category") hd = <><CatIcon c={k} /><b>{k}</b></>;
        else if (G === "customer") hd = <><Logo c={custOf(list[0].t)} name={k} size={28} /><b>{k}</b></>;
        else hd = <><span className="hic"><Icon name="clock" /></span><b>{k}</b></>;
        const tk = list.map((r) => r.took).sort((a, b) => a - b), med = tk[Math.floor((tk.length - 1) / 2)];
        return (
          <section key={k} className="colm">
            <header>{hd}<span className="badge" title={cnt.get(k) + " closed, typically " + dur(med) + " to close"}>{cnt.get(k)}</span></header>
            {list.map((r) => <HistCard key={r.t.id} r={r} />)}
          </section>
        );
      })}
    </div>
  );
}

export function History() {
  useApp();
  const H = S.hist, rows = histRows() as HistRow[], q = H.text.toLowerCase();
  const all = [...S.byId.values()].filter((t) => t.status === "closed" || t.status === "closing");

  /* The search box keeps what's typed; S.hist.text holds it trimmed. Follow outside changes when it isn't focused. */
  const [txt, setTxt] = useState(H.text);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { if (txt.trim() !== H.text && document.activeElement !== box.current) setTxt(H.text); });

  const set = (k: keyof typeof S.hist, v: any) => { (S.hist as any)[k] = v; commit(); };
  const custs = [...new Set(all.map(custName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const whoOpts: [string, string][] = ([["", "Anyone"]] as [string, string][])
    .concat(S.meId ? [["me", "Me"]] : [])
    .concat(staffSorted().map((m): [string, string] => [m.uid ? "u:" + m.uid : "l:" + m.label, staffName(m)]))
    .concat([["none", "Unassigned"]]);
  const filtered = !!(H.text || H.customer || H.category || H.who || H.sev || H.range);

  const tk = rows.map((r) => r.took).sort((a, b) => a - b), med = tk.length ? tk[Math.floor((tk.length - 1) / 2)] : 0;
  const met = rows.filter((r) => sla(r.t).state === "met").length, mins = rows.reduce((a, r) => a + r.mins, 0);

  const shown = rows.slice(0, H.limit), grp = H.sort === "new" || H.sort === "old";
  const counts: Record<string, number> = {};
  if (grp) for (const r of rows) { const k = month(r.c.ms); counts[k] = (counts[k] || 0) + 1; }
  const trs: ReactNode[] = [];
  let last = "";
  for (const r of shown) {
    const t = r.t;
    if (grp) { const k = month(r.c.ms); if (k !== last) { last = k; trs.push(<tr key={"g:" + k} className="grp"><td colSpan={10}>{k}<span>{counts[k]} closed</span></td></tr>); } }
    trs.push(
      <tr key={t.id} className="row" tabIndex={0} data-act="open" data-id={t.id} aria-selected={S.sel === t.id}
        onClick={() => openTicket(t.id)} onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) openTicket(t.id); }}>
        <td className="wrap"><div className="lead"><CatIcon c={t.category} /><div>
          <span className="subj">{t.subject}</span>
          <span className="sub2"><ChanIcon c={t.channel} /><Ava label={t.requesterName} size={18} /><span>{(t.requesterName ? t.requesterName + ", " : "") + custName(t)}</span></span>
          {r.h.where ? <span className="hit"><b>{r.h.where}:</b> <Snippet text={r.h.text || ""} q={q} /></span> : null}
        </div></div></td>
        <td className="c-id"><span className="tid">{t.id}</span></td>
        <td><Sev k={t.severity} /></td>
        <td className="c-cat muted">{t.category}</td>
        <td className="c-asg">{t.assigneeId || t.assigneeLabel ? <Person uid={t.assigneeId} label={t.assigneeLabel} /> : <span className="muted">Unassigned</span>}</td>
        <td className="muted num">{abs(t.createdAt).slice(0, 10)}</td>
        <td className="num" title={abs(r.c.at) + (r.c.auto ? ", closed automatically" : r.c.by || r.c.byLabel ? ", closed by " + whoText(r.c.by, r.c.byLabel) : "")}>{t.status === "closing" ? <StatusChip k="closing" /> : abs(r.c.at).slice(0, 10)}</td>
        <td className="num">{dur(r.took)}</td>
        <td className="r num muted">{r.mins ? fmtMin(r.mins) : "–"}</td>
        <td className="c-sla num"><SlaText t={t} /></td>
      </tr>,
    );
  }

  const bd = P.histView === "board";
  const older = !!(ref.db && S.archMore && S.tickets.length >= 1000);

  return (
    <>
      <div className="pagehead">
        <div><h1>Closed ticket history</h1><p>Every closed ticket, newest first, with how long it took and what was logged. Search covers notes too, so you can find how something was fixed last time.</p></div>
        <div className="toolbar" style={{ margin: 0 }}>
          <div className="pills" id="hist-layout">
            {(["board", "list"] as const).map((v) => (
              <button key={v} data-act="pref" data-k="histView" data-val={v} aria-pressed={P.histView === v} onClick={() => setPref("histView", v)}>{v === "board" ? "Board" : "List"}</button>
            ))}
          </div>
          <select className="field" id="h-group" aria-label="Board columns" hidden={!bd} value={P.histGroup} onChange={(e) => setPref("histGroup", e.target.value)}>
            <option value="month">Columns by month</option><option value="agent">Columns by agent</option><option value="category">Columns by category</option><option value="customer">Columns by customer</option>
          </select>
          <button className="btn dark" data-act="export-history" id="h-export" hidden={!svc.downloads} onClick={() => exportHistory()}>Export CSV</button>
        </div>
      </div>
      <div className="tiles t4 card" id="h-tiles">
        <div className="tile"><span className="lbl">{"Closed" + (H.range ? ", " + H.range + " days" : "")}</span><span className="val">{rows.length}</span><div className="foot">{H.text || H.customer || H.category || H.who || H.sev ? "Matching these filters" : "All closed tickets loaded"}</div></div>
        <div className="tile"><span className="lbl">Typical time to close</span><span className="val">{rows.length ? dur(med) : "–"}</span><div className="foot">Median, opened to closed</div></div>
        <div className="tile"><span className="lbl">Resolution target met</span><span className="val">{rows.length ? Math.round(met * 100 / rows.length) + "%" : "–"}</span><div className="foot">{met + " of " + rows.length}</div></div>
        <div className="tile"><span className="lbl">Time logged</span><span className="val">{fmtMin(mins)}</span><div className="foot">Across these tickets</div></div>
      </div>
      <div className="toolbar">
        <div className="searchbox" id="h-sb">
          <input ref={box} className="field" id="h-text" type="search" placeholder="Search ID, subject, notes, customer, requester" aria-label="Search closed tickets"
            value={txt} onChange={(e) => { const v = e.target.value; setTxt(v); S.hist.text = v.trim(); S.hist.limit = 150; commit(); }} />
        </div>
        <select className="field" id="h-customer" aria-label="Customer" value={custs.includes(H.customer) ? H.customer : ""} onChange={(e) => set("customer", e.target.value)}>
          <option value="">All customers</option><Options list={custs} />
        </select>
        <select className="field" id="h-category" aria-label="Category" value={S.cfg.categories.includes(H.category) ? H.category : ""} onChange={(e) => set("category", e.target.value)}>
          <option value="">All categories</option><Options list={S.cfg.categories} />
        </select>
        <select className="field" id="h-who" aria-label="Handled by" value={H.who} onChange={(e) => set("who", e.target.value)}>
          {whoOpts.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
        </select>
        <select className="field" id="h-sev" aria-label="Severity" value={H.sev} onChange={(e) => set("sev", e.target.value)}>
          <option value="">Any severity</option><option value="S1">S1 Critical</option><option value="S2">S2 High</option><option value="S3">S3 Medium</option><option value="S4">S4 Low</option>
        </select>
        <select className="field" id="h-range" aria-label="Closed in" value={String(H.range)} onChange={(e) => { S.hist.range = +e.target.value; S.hist.limit = 150; commit(); }}>
          <option value="0">Closed any time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option>
        </select>
        <select className="field" id="h-st" aria-label="Which tickets" value={H.st} onChange={(e) => set("st", e.target.value)}>
          <option value="closed">Closed only</option><option value="both">Closed and closing</option>
        </select>
        <select className="field" id="h-sort" aria-label="Sort" value={H.sort} onChange={(e) => set("sort", e.target.value)}>
          <option value="new">Newest closed first</option><option value="old">Oldest closed first</option><option value="long">Longest to close</option><option value="time">Most time logged</option>
        </select>
        <button className="btn" data-act="hist-clear" id="h-clear" hidden={!filtered}
          onClick={() => { Object.assign(S.hist, { text: "", customer: "", category: "", who: "", sev: "", range: 0, limit: 150 }); setTxt(""); commit(); }}>Clear filters</button>
      </div>
      <div className="card tablecard"><div className="scroll-x">
        <div id="h-board" hidden={!bd}>{bd && shown.length ? <HistBoard shown={shown} rows={rows} /> : null}</div>
        <table className="htable" id="h-table" hidden={bd}>
          <thead><tr><th>Ticket</th><th className="c-id">ID</th><th>Severity</th><th className="c-cat">Category</th><th className="c-asg">Handled by</th><th>Opened</th><th>Closed</th><th>Took</th><th className="r">Logged</th><th className="c-sla">SLA</th></tr></thead>
          <tbody id="h-body">{trs}</tbody>
        </table>
        <div className="empty" id="h-empty" hidden={rows.length > 0}>
          {rows.length ? null : !S.loaded ? "Loading"
            : all.length ? <><Mascot mood="sleepy" className="mm" /><b>No closed tickets match</b>Widen the period or clear the filters.</>
            : <><Mascot mood="sleepy" className="mm" /><b>Nothing closed yet</b>Tickets land here once they're closed.</>}
        </div>
      </div></div>
      <div style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span className="muted" id="h-count">{rows.length ? shown.length + " of " + rows.length + " closed tickets" + (S.arch.size ? " (including " + S.arch.size + " older ones loaded)" : "") : ""}</span>
        <button className="btn" data-act="hist-more" id="h-more" hidden={rows.length <= H.limit} onClick={() => { S.hist.limit += 150; commit(); }}>Show more</button>
        <button className="btn" data-act="hist-older" id="h-older" hidden={!older} disabled={S.archBusy} onClick={() => loadOlderClosed()}>{S.archBusy ? "Loading…" : "Load older closed tickets"}</button>
      </div>
    </>
  );
}
