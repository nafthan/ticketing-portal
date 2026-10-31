/*
 * Ticket cards for the boards: ticketCard(t,i,drag,mv) and histCard(r) in the
 * single-file edition.
 */
import type { KeyboardEvent, MouseEvent } from "react";
import { S } from "../core/state.ts";
import { custOf, custName, whoText } from "../core/people.ts";
import { openTicket } from "../core/tickets.ts";
import { rel, abs, dur, fmtMin, snippetParts } from "../core/format.ts";
import type { Ticket } from "../core/types.ts";
import { Icon, Ava, Sev, StatusChip, CatIcon, ChanIcon, Logo, Tier, SlaText } from "./index.tsx";
import { moveStep } from "./dnd.ts";

export interface MoveArrows { q: string; first: boolean; last: boolean; req: boolean }

const enter = (id: string) => (e: KeyboardEvent<HTMLElement>) => { if (e.key === "Enter" && e.target === e.currentTarget) openTicket(id); };

/**
 * ticketCard(t, i, drag, mv). `done` shows the status and when it was resolved
 * instead of severity and SLA (My desk's "Recently finished" column).
 */
export function TicketCard({ t, i, drag, mv, done }: { t: Ticket; i: number; drag?: boolean; mv?: MoveArrows | null; done?: boolean }) {
  const c = custOf(t);
  const step = (dir: "up" | "down") => (e: MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); if (mv) moveStep(e.currentTarget, dir, t.id, mv.q); };
  return (
    <div role="button" tabIndex={0} className={"tk " + t.severity} data-act="open" data-id={t.id} aria-selected={S.sel === t.id}
      draggable={drag ? true : undefined} onClick={() => openTicket(t.id)} onKeyDown={enter(t.id)}>
      {mv ? (
        <span className="mv">
          <button data-act="mv" data-d="up" data-id={t.id} data-q={mv.q} disabled={mv.first} aria-label={"Move " + t.id + " up"} title={mv.req ? "Ask to move up" : "Move up"} onClick={step("up")}><Icon name="aup" /></button>
          <button data-act="mv" data-d="down" data-id={t.id} data-q={mv.q} disabled={mv.last} aria-label={"Move " + t.id + " down"} title={mv.req ? "Ask to move down" : "Move down"} onClick={step("down")}><Icon name="adn" /></button>
        </span>
      ) : null}
      <span className="r1"><CatIcon c={t.category} /><Logo c={c} name={custName(t)} size={22} /><span className="tid">{t.id}</span><Tier c={c} /><span className="rank num" title="Position in this list">{i + 1}</span></span>
      <span className="sj">{t.subject}</span>
      <span className="sub2"><ChanIcon c={t.channel} /><Ava label={t.requesterName} size={18} /><span>{(t.requesterName ? t.requesterName + ", " : "") + custName(t)}</span></span>
      {done
        ? <span className="r3"><StatusChip k={t.status} /><span className="num muted">{rel(t.resolvedAt)}</span></span>
        : <span className="r3"><Sev k={t.severity} mini /><span className="num"><SlaText t={t} /></span></span>}
    </div>
  );
}

/** A search match from histHit, cut down around the match with it highlighted (snippet(text, q)). */
export function Snippet({ text, q }: { text: string; q: string }) {
  const p = snippetParts(text, q);
  return <>{p.before}<mark>{p.match}</mark>{p.after}</>;
}

/** A row from histRows(): { t, c: closeInfo(t), h: histHit(t, q), took, mins }. */
export interface HistRow { t: Ticket; c: { at: string; ms: number; by: string | null; byLabel: string | null; auto: boolean }; h: { ok: boolean; where?: string; text?: string }; took: number; mins: number }

/** histCard(r) */
export function HistCard({ r }: { r: HistRow }) {
  const t = r.t, c = custOf(t), asg = t.assigneeId || t.assigneeLabel;
  return (
    <div role="button" tabIndex={0} className={"tk closed " + t.severity} data-act="open" data-id={t.id} aria-selected={S.sel === t.id}
      onClick={() => openTicket(t.id)} onKeyDown={enter(t.id)}>
      <span className="r1"><CatIcon c={t.category} /><Logo c={c} name={custName(t)} size={22} /><span className="tid">{t.id}</span><Tier c={c} /></span>
      <span className="sj">{t.subject}</span>
      <span className="sub2">{asg
        ? <><Ava uid={t.assigneeId} label={t.assigneeLabel} size={18} /><span>{whoText(t.assigneeId, t.assigneeLabel) + ", " + custName(t)}</span></>
        : <span>{"Unassigned, " + custName(t)}</span>}</span>
      {r.h.where ? <span className="hit" style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}><b>{r.h.where}:</b> <Snippet text={r.h.text || ""} q={S.hist.text.toLowerCase()} /></span> : null}
      <span className="r3">
        {t.status === "closing" ? <StatusChip k="closing" /> : <span className="num muted" title="Closed">{abs(r.c.at).slice(0, 10)}</span>}
        <span className="took num" title={"Opened to closed" + (r.mins ? ", " + fmtMin(r.mins) + " logged" : "")}>{dur(r.took) + " "}<SlaText t={t} /></span>
      </span>
    </div>
  );
}
