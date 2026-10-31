/*
 * The Queue tab: renderHero, renderBanner, renderQueue in the single-file edition.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { S, P, commit } from "../core/state.ts";
import { ACTIVE } from "../core/constants.ts";
import { fmtHrs, plural } from "../core/format.ts";
import { mascot } from "../core/art.ts";
import { isMgr } from "../core/people.ts";
import { sla } from "../core/hours.ts";
import { activeFilters, matchBase, matchStatus, sortTickets, perDay, customers, resetFilters } from "../core/queue.ts";
import { loadDemo, removeSamples } from "../core/data.ts";
import { useApp, Mascot, Spark } from "../ui/index.tsx";
import { TicketRow } from "../ui/tickets.tsx";
import { Pins } from "../shell/Pins.tsx";
import { squishes } from "../shell/squish.ts";
import type { Ticket } from "../core/types.ts";


/** tile(label, val, extra, act, sub, hot), keeping the legacy data-act for tests. */
function QTile({ label, val, act, sub, hot, onClick, children }: { label: string; val: ReactNode; act: string; sub?: string; hot?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className="tile" data-act={act} onClick={onClick}>
      <span className="lbl">{hot ? <span className="dot hot" /> : null}{label}</span>
      <span className="val">{val}</span>
      {sub ? <span title={sub}>{children}</span> : children}
    </button>
  );
}

const q = () => S.q;
function tileActive() { resetFilters(); q().status = "active"; commit(); }
function tileUn() { resetFilters(); q().status = "active"; q().assignee = "none"; commit(); }
function tileHi() { resetFilters(); q().status = "active"; q().sev = "hi"; commit(); }
function tileBr() { resetFilters(); q().status = "active"; q().sla = "breached"; commit(); }
function tileRes() { resetFilters(); q().status = "resolved"; q().sort = "updatedAt"; q().dir = "desc"; commit(); }

/** renderHero(act, un, br) */
function Hero({ act, un, br }: { act: Ticket[]; un: number; br: Ticket[] }) {
  const h = new Date().getHours(), first = (S.meName || "").trim().split(/\s+/)[0];
  const greet = (h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening") + (first ? ", " + first : "");
  let mood = "happy", msg: string, btn: ReactNode = null;
  if (!S.loaded) msg = "Fetching the queue.";
  else if (!S.tickets.length) { mood = "sleepy"; msg = S.canWrite ? "Nothing here yet. Log the first ticket and I'll keep track of it." : "Nothing here yet. Tickets appear as they're logged."; }
  else if (br.length) {
    mood = "worried";
    const worst = br.slice().sort((a, b) => sla(a).key - sla(b).key)[0];
    msg = plural(br.length, "ticket") + " past target. " + worst.id + " has waited longest.";
    btn = <button className="linkbtn" data-act="tile-br" onClick={tileBr}>{"Show " + (br.length === 1 ? "it" : "them")}</button>;
  }
  else if (un) { msg = plural(un, "ticket") + " waiting for an owner."; btn = <button className="linkbtn" data-act="tile-un" onClick={tileUn}>Show unassigned</button>; }
  else if (!act.length) { mood = "party"; msg = "The queue is clear. Nice work."; }
  else msg = plural(act.length, "active ticket") + ", all inside target.";
  // Read by the squish handler to restore Ping's face after a squish (legacy S.heroMood).
  S.heroMood = mood;
  // The squish handler swaps this element's markup during an animation, so it
  // owns its innerHTML (as in the single-file edition) rather than a React child.
  const face = P.mascot ? mascot(mood, true) : "";
  return (
    <div className={"hero" + (P.mascot ? "" : " nomascot")} id="hero">
      <div className="mwrap">
        <div className="m squishy" id="hero-m" role="button" tabIndex={0} aria-label="Squish Ping" title="Squish me" dangerouslySetInnerHTML={{ __html: face }} />
        <span className="sq-hint" id="sq-hint" hidden={!(P.mascot && !squishes())}>psst, squish me</span>
      </div>
      <div>
        <h1 id="greet">{greet}</h1>
        <div className="bubble" id="bubble" aria-live="polite"><span>{msg}</span>{btn}</div>
      </div>
    </div>
  );
}

/** renderBanner() */
function Banner() {
  const [busy, setBusy] = useState(false);
  const n = S.tickets.filter((t) => t.sample).length;
  return (
    <div id="banner">
      {S.mode === "local" && !S.tickets.length ? (
        <div className="note"><span>No tickets yet. Want to look around first?</span><button className="btn" data-act="load-demo" onClick={() => loadDemo()}>Load sample data</button></div>
      ) : null}
      {n && isMgr() ? (
        <div className="note">
          <span>{n} sample tickets, plus sample customers and team members, are loaded so every page has something to show.</span>
          {S.confirmSample ? <>
            <button className="btn dark" data-act="sample-yes" disabled={busy} onClick={() => { setBusy(true); removeSamples(); }}>{"Remove all " + n}</button>
            <button className="btn" data-act="sample-no" onClick={() => { S.confirmSample = false; commit(); }}>Keep them</button>
          </> : <button className="btn" data-act="sample-ask" onClick={() => { S.confirmSample = true; commit(); }}>Remove sample tickets</button>}
        </div>
      ) : null}
    </div>
  );
}

const SEGS: [string, string][] = [["active", "Active"], ["new", "New"], ["open", "Open"], ["pending", "Pending"], ["resolved", "Resolved"], ["closing", "Closing"], ["closed", "Closed"], ["all", "All"]];

function SortTh({ k, label, className }: { k: string; label: string; className?: string }) {
  const on = S.q.sort === k;
  return (
    <th className={className} aria-sort={on ? (S.q.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button data-act="sort" data-k={k} onClick={() => {
        if (S.q.sort === k) S.q.dir = S.q.dir === "asc" ? "desc" : "asc";
        else { S.q.sort = k; S.q.dir = k === "updatedAt" ? "desc" : "asc"; }
        commit();
      }}>{label + (on ? (S.q.dir === "asc" ? " ↑" : " ↓") : "")}</button>
    </th>
  );
}

/** A filter <select>: setSelect(el, first, items, val). */
function ListSelect({ id, label, first, items, k }: { id: string; label: string; first: string; items: string[]; k: "customer" | "team" | "category" }) {
  const val = items.includes(S.q[k]) ? S.q[k] : "";
  return (
    <select className="field" id={id} aria-label={label} value={val} onChange={(e) => { S.q[k] = e.target.value; commit(); }}>
      <option value="">{first}</option>
      {items.map((i) => <option key={i} value={i}>{i}</option>)}
    </select>
  );
}

export function Queue() {
  useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(S.q.text);
  // Pick up changes made elsewhere (Clear filters, tiles) unless the person is typing.
  useEffect(() => {
    if (text.trim() !== S.q.text && document.activeElement !== inputRef.current) setText(S.q.text);
  });

  const act = S.tickets.filter((t) => ACTIVE.has(t.status));
  const un = act.filter((t) => !t.assigneeId && !t.assigneeLabel).length;
  const hi = act.filter((t) => t.severity === "S1" || t.severity === "S2").length;
  const brl = act.filter((t) => sla(t).state === "breached"), br = brl.length;
  const wk = Date.now() - 7 * 864e5;
  const res = S.tickets.filter((t) => t.resolvedAt && new Date(t.resolvedAt).getTime() >= wk).length;
  const base = S.tickets.filter(matchBase);
  const rows: Ticket[] = sortTickets(base.filter((t) => matchStatus(t, S.q.status)));
  const setQ = (k: "sev" | "assignee" | "sla", v: string) => { S.q[k] = v; commit(); };

  let empty: ReactNode = null;
  if (!rows.length) {
    const m = <Mascot mood={S.tickets.length ? "happy" : "sleepy"} className="mm" />;
    empty = !S.loaded ? "Loading tickets"
      : !S.tickets.length ? <>{m}<b>The queue is empty</b>{S.canWrite ? "Create the first ticket to start tracking work." : "Tickets will appear here as they're logged."}</>
        : <>{m}<b>No tickets match these filters</b>Change the status tab or clear the filters.</>;
  }

  return (
    <>
      <Hero act={act} un={un} br={brl} />
      <Banner />
      <Pins where="queue" />
      <div className="tiles card" id="q-tiles">
        <QTile label="Active" val={act.length} act="tile-active" sub="Opened per day, 14 days" onClick={tileActive}><Spark vals={perDay("createdAt", 14)} color="var(--accent)" /></QTile>
        <QTile label="Unassigned" val={un} act="tile-un" onClick={tileUn}><div className="foot">Waiting for an owner</div></QTile>
        <QTile label="S1 and S2" val={hi} act="tile-hi" onClick={tileHi}><div className="foot">Critical and high, still active</div></QTile>
        <QTile label="SLA breached" val={br} act="tile-br" hot={br > 0} onClick={tileBr}><div className="foot">Past the resolution target</div></QTile>
        <QTile label="Resolved, 7 days" val={res} act="tile-res" sub="Resolved per day, 14 days" onClick={tileRes}><Spark vals={perDay("resolvedAt", 14)} color="var(--good)" /></QTile>
      </div>
      <div className="toolbar">
        <div className="searchbox" id="q-sb">
          <input ref={inputRef} className="field" id="q-text" type="search" placeholder="Search ID, subject, customer, requester" aria-label="Search tickets"
            value={text} onChange={(e) => { setText(e.target.value); S.q.text = e.target.value.trim(); commit(); }} />
        </div>
        <ListSelect id="q-customer" label="Customer" first="All customers" items={customers()} k="customer" />
        <select className="field" id="q-sev" aria-label="Severity" value={S.q.sev} onChange={(e) => setQ("sev", e.target.value)}>
          <option value="">Any severity</option><option value="hi">S1 and S2</option>
          <option value="S1">S1 Critical</option><option value="S2">S2 High</option><option value="S3">S3 Medium</option><option value="S4">S4 Low</option>
        </select>
        <ListSelect id="q-team" label="Team" first="All teams" items={S.cfg.teams} k="team" />
        <ListSelect id="q-category" label="Category" first="All categories" items={S.cfg.categories} k="category" />
        <select className="field" id="q-assignee" aria-label="Assignee" value={S.q.assignee} onChange={(e) => setQ("assignee", e.target.value)}>
          <option value="">Anyone</option><option value="me">Assigned to me</option><option value="none">Unassigned</option>
        </select>
        <select className="field" id="q-sla" aria-label="SLA" value={S.q.sla} onChange={(e) => setQ("sla", e.target.value)}>
          <option value="">Any SLA</option><option value="breached">Breached</option><option value="soon">{"Due within " + fmtHrs(S.cfg.rules.soonHours)}</option>
        </select>
        <button className="btn" data-act="clear-filters" id="q-clear" hidden={!activeFilters()} onClick={() => { resetFilters(); setText(""); commit(); }}>Clear filters</button>
      </div>
      <div className="seg" id="q-seg" role="group" aria-label="Status">
        {SEGS.map(([k, l]) => (
          <button key={k} data-act="status" data-s={k} aria-pressed={S.q.status === k} onClick={() => { S.q.status = k; commit(); }}>
            {l}<span className="num">{base.filter((t) => matchStatus(t, k)).length}</span>
          </button>
        ))}
      </div>
      <div className="card tablecard"><div className="scroll-x">
        <table>
          <thead><tr>
            <SortTh k="subject" label="Ticket" />
            <SortTh k="id" label="ID" className="c-id" />
            <SortTh k="sev" label="Severity" />
            <SortTh k="status" label="Status" />
            <th className="c-cat">Category</th>
            <th className="c-team">Team</th>
            <th className="c-asg">Assignee</th>
            <SortTh k="updatedAt" label="Updated" />
            <SortTh k="sla" label="SLA" className="c-sla" />
          </tr></thead>
          <tbody id="q-body">{rows.map((t) => <TicketRow key={t.id} t={t} full />)}</tbody>
        </table>
        <div className="empty" id="q-empty" hidden={rows.length > 0}>{empty}</div>
      </div></div>
    </>
  );
}
