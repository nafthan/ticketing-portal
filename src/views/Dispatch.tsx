/*
 * Dispatch: renderDispatch() in the single-file edition. Agent columns
 * (board) or agent groups (list), with drag and drop to reorder within a
 * column or reassign by dropping on another (see ui/dnd.ts).
 */
import type { CSSProperties } from "react";
import { S, P, commit } from "../core/state.ts";
import { plural } from "../core/format.ts";
import { sla } from "../core/hours.ts";
import { isMgr, canRequest, canTake } from "../core/people.ts";
import { queueOf, resetQueue, dispatchGroups } from "../core/queues.ts";
import { setPref } from "../core/prefs.ts";
import type { Staff, Ticket } from "../core/types.ts";
import { useApp, Icon, Ava, Who, MemPills, Options } from "../ui/index.tsx";
import { TicketRow, type DispOpts } from "../ui/tickets.tsx";
import { TicketCard } from "../ui/TicketCard.tsx";
import { dnd } from "../ui/dnd.ts";
import { Pins } from "../shell/Pins.tsx";

interface Group { key: string; uid: string | null; label: string | null; list: Ticket[]; mem?: Staff | null; q: string }
type Disp = DispOpts;

function Head({ g }: { g: Group }) {
  const hot = g.list.some((t) => sla(t).state === "breached");
  return (
    <>
      {g.key === "none"
        ? <><span className="av" style={{ "--s": "28px" } as CSSProperties}><Icon name="user" /></span><b>Unassigned</b></>
        : <><Ava uid={g.uid} label={g.label} size={28} /><div style={{ flex: 1, minWidth: 0 }}><b><Who uid={g.uid} label={g.label} /></b><MemPills m={g.mem} g={g} /></div></>}
      <span className={"badge" + (hot ? " hot" : "")} title={hot ? "Includes tickets past target" : "Active tickets"}>{g.list.length}</span>
    </>
  );
}

function QTools({ q, style }: { q: string; style?: CSSProperties }) {
  return (
    <div className="qtools" style={style}>
      <span className="pill" title="A manager has set the order of this list">Custom order</span>
      {isMgr() && S.canWrite ? <button className="linkbtn" data-act="q-reset" data-q={q} onClick={() => resetQueue(q)}>Reset</button> : null}
    </div>
  );
}

/** miniTable(rows, {ranked:true, take, disp}) with its card wrapper replaced by a plain <div>, as the list view did. */
function GroupTable({ rows, take, disp }: { rows: Ticket[]; take: boolean; disp: Disp }) {
  return (
    <div><div className="scroll-x"><table>
      <thead><tr><th>Ticket</th><th className="c-id">ID</th><th>Severity</th><th>Status</th><th>Updated</th><th className="c-sla">SLA</th><th className="r">{disp.order || disp.move ? "Order and owner" : ""}</th></tr></thead>
      <tbody>{rows.map((t, i) => <TicketRow key={t.id} t={t} rank={i + 1} take={take} disp={disp} />)}</tbody>
    </table></div></div>
  );
}

export function Dispatch() {
  useApp();
  const groups = dispatchGroups() as Group[];
  const total = groups.reduce((n, g) => n + g.list.length, 0), agents = groups.filter((g) => g.key !== "none" && g.list.length).length;
  const sub = !S.loaded ? "Loading tickets"
    : plural(total, "active ticket") + " across " + plural(agents, "agent") + ". Lists start in priority order: highest severity, then the nearest target." +
      (S.canWrite && P.board === "board" ? (isMgr() ? " Drag a ticket up or down to change the order, or onto someone on shift to reassign it." : canRequest() ? " Drag a ticket or use its arrows to ask a manager to reorder or reassign it." : "") : "");

  let body;
  if (P.board === "list") {
    const req = canRequest(), mgr = isMgr();
    const shown = groups.filter((g) => g.key === "none" || g.list.length || g.mem);
    body = shown.length ? shown.map((g) => {
      const drop = S.canWrite && (g.key === "none" || req || ((mgr || (g.uid && g.uid === S.meId)) && canTake(g.uid, g.label)));
      const canOrder = S.canWrite && (mgr || req) && g.list.length > 1, custom = !!queueOf(g.q);
      const disp: Disp = { q: g.q, n: g.list.length, order: canOrder, req, move: S.canWrite && (mgr || req || g.key === "none"), drag: S.canWrite && (mgr || req || g.key === "none" || g.uid === S.meId) };
      return (
        <div key={g.key} className="agent-group" data-q={g.q} data-drop={drop ? g.key : undefined}>
          <div className="card tablecard">
            <div className="agent-h"><Head g={g} /></div>
            {custom ? <QTools q={g.q} style={{ margin: "10px 16px 0" }} /> : null}
            {g.list.length
              ? <GroupTable rows={g.list} take={g.key === "none" && S.canWrite && !!S.meId} disp={disp} />
              : <div className="muted" style={{ padding: "14px 16px" }}>{(g.key === "none" ? "Nothing waiting for an owner" : "Nothing active") + (drop ? ". Drag a ticket here to move it." : "")}</div>}
          </div>
        </div>
      );
    }) : <div className="card empty"><b>No active tickets</b>Everything is resolved or closed.</div>;
  } else {
    body = (
      <div className="board">
        {groups.map((g) => {
          const drop = S.canWrite && (g.key === "none" || canRequest() || ((isMgr() || (g.uid && g.uid === S.meId)) && canTake(g.uid, g.label)));
          const canOrder = S.canWrite && (isMgr() || canRequest()), custom = !!queueOf(g.q);
          return (
            <section key={g.key} className={"colm" + (g.key === "none" ? " un" : canTake(g.uid, g.label) ? "" : " off")} data-q={g.q} data-drop={drop ? g.key : undefined}>
              <header><Head g={g} /></header>
              {custom ? <QTools q={g.q} /> : null}
              {g.list.length
                ? g.list.map((t, i) => (
                  <TicketCard key={t.id} t={t} i={i}
                    drag={S.canWrite && (isMgr() || canRequest() || !(t.assigneeId || t.assigneeLabel) || (!!S.meId && t.assigneeId === S.meId))}
                    mv={canOrder && g.list.length > 1 ? { q: g.q, first: i === 0, last: i === g.list.length - 1, req: canRequest() } : null} />
                ))
                : <div className="none">{g.key === "none" ? "Nothing waiting for an owner" : "Nothing active"}</div>}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div className="pagehead">
        <div><h1>Dispatch</h1><p id="disp-sub">{sub}</p></div>
        <div className="toolbar" style={{ margin: 0 }}>
          <div className="pills" id="disp-layout">
            {(["board", "list"] as const).map((v) => (
              <button key={v} data-act="pref" data-k="board" data-val={v} aria-pressed={P.board === v} onClick={() => setPref("board", v)}>{v === "board" ? "Board" : "List"}</button>
            ))}
          </div>
          <select className="field" id="disp-team" aria-label="Team" value={S.cfg.teams.includes(S.disp.team) ? S.disp.team : ""}
            onChange={(e) => { S.disp.team = e.target.value; commit(); }}>
            <option value="">All teams</option>
            <Options list={S.cfg.teams} />
          </select>
        </div>
      </div>
      <Pins where="dispatch" />
      <div id="disp-body" {...dnd}>{body}</div>
    </>
  );
}
