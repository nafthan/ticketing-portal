/*
 * Ticket list pieces shared by the Queue, My desk and Dispatch:
 * ticketRow(t, o) and miniTable(rows, o) in the single-file edition.
 */
import type { KeyboardEvent, MouseEvent } from "react";
import { S } from "../core/state.ts";
import { rel } from "../core/format.ts";
import { custName } from "../core/people.ts";
import { assign, openTicket, takeTicket, moveOptions } from "../core/tickets.ts";
import { moveInQueue, colTickets } from "../core/queues.ts";
import type { Ticket } from "../core/types.ts";
import { Ava, CatIcon, ChanIcon, Icon, Person, Sev, SlaText, StatusChip } from "./index.tsx";

export interface DispOpts { q: string; n: number; order: boolean; req: boolean; move: boolean; drag: boolean }

/**
 * The ids in the same Dispatch column or agent group as `el`, in the order
 * they're shown (legacy `mv` action). Falls back to the column's stored order.
 */
function columnIds(el: Element, q: string): string[] {
  const col = el.closest(".colm,.agent-group");
  if (col) return [...col.querySelectorAll<HTMLElement>(".tk,.tkr")].map((c) => c.dataset.id || "");
  return colTickets(q).map((t: Ticket) => t.id);
}

function move(e: MouseEvent<HTMLButtonElement>, t: Ticket, d: DispOpts, dir: "up" | "down") {
  const ids = columnIds(e.currentTarget, d.q), i = ids.indexOf(t.id);
  if (dir === "up" && i > 0) moveInQueue(d.q, t.id, ids[i - 1], null);
  if (dir === "down" && i >= 0 && i < ids.length - 1) moveInQueue(d.q, t.id, null, ids[i + 1]);
}

/** ticketRow(t, o) */
export function TicketRow(props: { t: Ticket; full?: boolean; rank?: number; take?: boolean; disp?: DispOpts }) {
  const { t, full, rank, take } = props, d = props.disp;
  const assigned = !!(t.assigneeId || t.assigneeLabel);
  const onClick = (e: MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as Element;
    if (target.closest(".rowacts")) return;
    const act = target.closest("[data-act]");
    if (act && act !== e.currentTarget) return;
    openTicket(t.id);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" && e.target === e.currentTarget) openTicket(t.id);
  };
  const takeBtn = (style?: any) => (
    <button className="btn" style={style} data-act="take-row" data-id={t.id} onClick={(e) => { e.stopPropagation(); takeTicket(t.id); }}>Assign to me</button>
  );
  return (
    <tr className={"row" + (d ? " tkr" : "")} tabIndex={0} data-act="open" data-id={t.id} aria-selected={S.sel === t.id}
      draggable={d && d.drag ? true : undefined} onClick={onClick} onKeyDown={onKeyDown}>
      <td className="wrap">
        <div className="lead">
          {rank ? <span className="rank num">{rank}</span> : null}
          <CatIcon c={t.category} />
          <div>
            <span className="subj">{t.subject}</span>
            <span className="sub2"><ChanIcon c={t.channel} /><Ava uid={null} label={t.requesterName} size={18} /><span>{t.requesterName ? t.requesterName + ", " : ""}{custName(t)}</span></span>
          </div>
        </div>
      </td>
      <td className="c-id"><span className="tid">{t.id}</span></td>
      <td><Sev k={t.severity} /></td>
      <td><StatusChip k={t.status} /></td>
      {full ? <>
        <td className="c-cat muted">{t.category}</td>
        <td className="c-team muted">{t.team}</td>
        <td className="c-asg">{assigned ? <Person uid={t.assigneeId} label={t.assigneeLabel} /> : <span className="muted">Unassigned</span>}</td>
      </> : null}
      <td className="muted">{rel(t.updatedAt)}</td>
      <td className="c-sla num"><SlaText t={t} /></td>
      {d ? (
        <td className="r">
          <div className="rowacts">
            {take && !assigned ? takeBtn({ height: 30 }) : null}
            {d.order ? <>
              <button className="mvb" data-act="mv" data-d="up" data-id={t.id} data-q={d.q} disabled={rank === 1}
                aria-label={"Move " + t.id + " up"} title={d.req ? "Ask to move up" : "Move up"} onClick={(e) => move(e, t, d, "up")}><Icon name="aup" /></button>
              <button className="mvb" data-act="mv" data-d="down" data-id={t.id} data-q={d.q} disabled={rank === d.n}
                aria-label={"Move " + t.id + " down"} title={d.req ? "Ask to move down" : "Move down"} onClick={(e) => move(e, t, d, "down")}><Icon name="adn" /></button>
            </> : null}
            {d.move ? (
              <select className="field" data-move={t.id} aria-label={"Move " + t.id + " to someone else"} value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  if (v === "none") assign(t.id, null, null);
                  else assign(t.id, v.startsWith("u:") ? v.slice(2) : null, v.startsWith("l:") ? v.slice(2) : null);
                }}>
                <option value="">{d.req ? "Ask to move to…" : "Move to…"}</option>
                {moveOptions(t).map((x: [string, string]) => <option key={x[0]} value={x[0]}>{x[1]}</option>)}
              </select>
            ) : null}
          </div>
        </td>
      ) : take ? <td className="r">{takeBtn()}</td> : null}
    </tr>
  );
}

/** miniTable(rows, o) */
export function MiniTable(props: { rows: Ticket[]; ranked?: boolean; take?: boolean; disp?: DispOpts }) {
  const { rows, ranked, take, disp } = props;
  if (!rows.length) return <div className="card tablecard"><div className="muted" style={{ padding: "14px 16px" }}>Nothing active</div></div>;
  return (
    <div className="card tablecard"><div className="scroll-x"><table>
      <thead><tr>
        <th>Ticket</th><th className="c-id">ID</th><th>Severity</th><th>Status</th><th>Updated</th><th className="c-sla">SLA</th>
        {take || disp ? <th className="r">{disp && (disp.order || disp.move) ? "Order and owner" : ""}</th> : null}
      </tr></thead>
      <tbody>
        {rows.map((t, i) => <TicketRow key={t.id} t={t} take={take} disp={disp} rank={ranked ? i + 1 : 0} />)}
      </tbody>
    </table></div></div>
  );
}
