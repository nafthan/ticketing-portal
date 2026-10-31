/*
 * My desk: renderMine() and mineBoard() in the single-file edition.
 */
import type { ReactNode } from "react";
import { S, P, ref, toast } from "../core/state.ts";
import { ACTIVE, EM_SHORT } from "../core/constants.ts";
import { fmtHrs, fmtMin } from "../core/format.ts";
import { sla } from "../core/hours.ts";
import { isMgr, canRequest, canTake, onShift, staffOf } from "../core/people.ts";
import { openTicket, setShift } from "../core/tickets.ts";
import { addStaff } from "../core/staff.ts";
import { qKey, queueOf, orderCol, prio, resetQueue } from "../core/queues.ts";
import { setEmail, composeUrl } from "../core/emails.ts";
import { setPref } from "../core/prefs.ts";
import type { Email, Ticket } from "../core/types.ts";
import { useApp, Icon, Mascot, Ava } from "../ui/index.tsx";
import { MiniTable } from "../ui/tickets.tsx";
import { TicketCard } from "../ui/TicketCard.tsx";
import { dnd } from "../ui/dnd.ts";

/** openBtn(m) */
function OpenBtn({ m }: { m: Email }) {
  if (!m.to) return null;
  const out = S.cfg.email.app !== "mailto";
  return (
    <a className="btn primary" href={composeUrl(m)} target={out ? "_blank" : undefined} rel={out ? "noopener noreferrer" : undefined}>
      <Icon name="mail" />{out ? "Open in Outlook" : "Open in email app"}
    </a>
  );
}

function ColHead({ ic, name, n, sub, hot }: { ic: ReactNode; name: string; n: number; sub?: string; hot?: boolean }) {
  return (
    <header>
      <span className="hic">{ic}</span>
      <div style={{ flex: 1, minWidth: 0 }}><b>{name}</b>{sub ? <small>{sub}</small> : null}</div>
      <span className={"badge" + (hot ? " hot" : "")}>{n}</span>
    </header>
  );
}

/** mineBoard(act, open, done) */
function MineBoard({ act, open, done }: { act: Ticket[]; open: Ticket[]; done: Ticket[] }) {
  const mq = qKey(S.meId, null), mine = S.canWrite && canTake(S.meId, null), order = S.canWrite && (isMgr() || canRequest()) && act.length > 1, custom = !!queueOf(mq);
  const none = (t: string) => <div className="none">{t}</div>;
  return (
    <div className="board roomy" style={{ marginTop: 8 }}>
      <section className="colm" data-q={mq} data-drop={mine ? "u:" + S.meId : undefined}>
        <ColHead ic={<Ava uid={S.meId} size={22} />} name="Up next" n={act.length} sub={custom ? "In the order a manager set" : "Most urgent first"} hot={act.some((t) => sla(t).state === "breached")} />
        {custom ? <div className="qtools"><span className="pill">Custom order</span>{isMgr() && S.canWrite ? <button className="linkbtn" data-act="q-reset" data-q={mq} onClick={() => resetQueue(mq)}>Reset</button> : null}</div> : null}
        {act.length
          ? act.map((t, i) => <TicketCard key={t.id} t={t} i={i} drag={S.canWrite} mv={order ? { q: mq, first: i === 0, last: i === act.length - 1, req: canRequest() } : null} />)
          : none("Nothing assigned to you" + (mine && open.length ? ". Drag a ticket here to take it." : ""))}
      </section>
      <section className="colm un" data-q="none" data-drop={S.canWrite ? "none" : undefined}>
        <ColHead ic={<Icon name="user" />} name="Waiting for an owner" n={open.length} sub={mine ? "Drag one to Up next to take it" : S.canWrite && ref.db && S.cfg.requireShift ? "Clock in to take tickets" : ""} />
        {open.length ? open.map((t, i) => <TicketCard key={t.id} t={t} i={i} drag={S.canWrite && mine} mv={null} />) : none("Nothing waiting for an owner")}
      </section>
      <section className="colm done">
        <ColHead ic={<Icon name="check" />} name="Recently finished" n={Math.min(done.length, 8)} sub="Resolved or closed by you" />
        {done.length ? done.slice(0, 8).map((t, i) => <TicketCard key={t.id} t={t} i={i} drag={false} mv={null} done />) : none("Nothing finished yet")}
      </section>
    </div>
  );
}

export function MyDesk() {
  useApp();
  const pills = (
    <div className="toolbar" style={{ margin: 0 }}>
      <div className="pills" id="mine-layout">
        {(["board", "list"] as const).map((v) => (
          <button key={v} data-act="pref" data-k="mineView" data-val={v} aria-pressed={S.meId ? P.mineView === v : undefined} onClick={() => setPref("mineView", v)}>{v === "board" ? "Board" : "List"}</button>
        ))}
      </div>
    </div>
  );

  if (!S.meId) {
    return (
      <>
        <div className="pagehead"><div><h1>My desk</h1><p id="mine-sub"></p></div>{pills}</div>
        <div className="tiles card" id="mine-tiles" hidden></div>
        <div id="mine-body">
          <div className="card empty"><Mascot mood="sleepy" className="mm" />{S.mode === "connecting" ? "Checking who you are" : <><b>Your desk needs a sign-in</b>Once the helpdesk is connected to your organisation's sign-in, the tickets assigned to you appear here.</>}</div>
        </div>
      </>
    );
  }

  const me = S.meId;
  const mine = S.tickets.filter((t) => t.assigneeId === me), act = orderCol(mine.filter((t) => ACTIVE.has(t.status)), qKey(me, null));
  const br = act.filter((t) => sla(t).state === "breached").length, soon = act.filter((t) => sla(t).state === "soon").length;
  const wk = Date.now() - 7 * 864e5, done = mine.filter((t) => t.resolvedAt).sort((a, b) => (a.resolvedAt! < b.resolvedAt! ? 1 : -1));
  const doneWk = done.filter((t) => new Date(t.resolvedAt!).getTime() >= wk).length;
  const open = S.tickets.filter((t) => ACTIVE.has(t.status) && !t.assigneeId && !t.assigneeLabel).sort(prio);
  const sub = act.length ? (queueOf(qKey(me, null)) ? "Your tickets, in the order a manager has set." : "Your tickets, most urgent first: highest severity, then the nearest target.") : "Nothing is assigned to you right now.";
  let myMin = 0;
  for (const t of S.tickets) for (const n of t.notes || []) if (n.by === me && (n.minutes as number) > 0 && new Date(n.at).getTime() >= wk) myMin += n.minutes as number;
  const pe: { t: Ticket; m: Email }[] = [];
  for (const t of S.tickets) if (t.assigneeId === me) for (const m of t.emails || []) if (m.status === "pending") pe.push({ t, m });
  const board = P.mineView === "board";

  const clockIn = () => { setShift(me, null, true).then((ok: any) => { if (ok) toast("You're clocked in. Tickets can be assigned to you now.", "happy"); }); };

  return (
    <>
      <div className="pagehead"><div><h1>My desk</h1><p id="mine-sub">{sub}</p></div>{pills}</div>
      <div className="tiles card" id="mine-tiles">
        <div className="tile"><span className="lbl">Assigned to you</span><span className="val">{act.length}</span></div>
        <div className="tile"><span className="lbl">{br ? <span className="dot hot" /> : null}Past target</span><span className="val">{br}</span></div>
        <div className="tile"><span className="lbl">{"Due within " + fmtHrs(S.cfg.rules.soonHours)}</span><span className="val">{soon}</span></div>
        <div className="tile"><span className="lbl">Resolved by you, 7 days</span><span className="val">{doneWk}</span></div>
        <div className="tile"><span className="lbl">Your time, 7 days</span><span className="val">{fmtMin(myMin)}</span></div>
      </div>
      <div id="mine-body" {...dnd}>
        {S.canWrite && ref.db && S.cfg.requireShift && !onShift(me) ? (
          <div className="note"><span>You're clocked out, so you can't take new tickets. You can still work on the ones you have.</span><button className="btn primary" data-act="clock-in" onClick={clockIn}>Clock in</button></div>
        ) : null}
        {S.canWrite && !staffOf(me) ? (isMgr()
          ? <div className="note"><span>You're not on the team list yet.</span><button className="btn" data-act="staff-me" onClick={() => addStaff(me, null)}>Add me to the team</button></div>
          : <div className="note"><span>You're not on the team list yet. Ask a manager to add you so you always have a column on Dispatch.</span></div>) : null}
        {board ? <MineBoard act={act} open={open} done={done} /> : (
          <>
            <h2 className="sec-h">Up next <span className="num">{act.length}</span></h2>
            {act.length ? <MiniTable rows={act} ranked /> : (
              <div className="card empty"><Mascot mood="party" className="mm" /><b>Your desk is clear</b>{open.length ? "Pick something up from the unassigned tickets below." : "Nothing is waiting for an owner either."}</div>
            )}
          </>
        )}
        {pe.length ? (
          <>
            <h2 className="sec-h">Emails to send <span className="num">{pe.length}</span></h2>
            <div className="card adcard" style={{ marginBottom: 8 }}>
              {pe.map(({ t, m }) => (
                <div key={t.id + "/" + m.id} className="lrow" style={{ flexWrap: "wrap" }}>
                  <span className="nm" style={{ display: "block", whiteSpace: "normal", minWidth: 220 }}>
                    <button className="linkbtn tid" style={{ borderBottomColor: "var(--line)" }} data-act="open" data-id={t.id} onClick={() => openTicket(t.id)}>{t.id}</button>{" "}
                    <b style={{ fontWeight: 500 }}>{m.subject}</b><br />
                    <span className="muted" style={{ fontSize: 12.5 }}>{((EM_SHORT as any)[m.event] || "email") + ", to " + (m.to ? m.to : "no email address on file")}</span>
                  </span>
                  <span className="actions">
                    <OpenBtn m={m} />
                    <button className="btn" data-act="em-sent" data-t={t.id} data-m={m.id} onClick={() => setEmail(t.id, m.id, "sent")}>Mark as sent</button>
                    <button className="btn" data-act="em-skip" data-t={t.id} data-m={m.id} onClick={() => setEmail(t.id, m.id, "skipped")}>Skip</button>
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : null}
        {!board && open.length ? <><h2 className="sec-h">Waiting for an owner <span className="num">{open.length}</span></h2><MiniTable rows={open} take={S.canWrite} /></> : null}
        {!board && done.length ? <><h2 className="sec-h">Recently finished</h2><MiniTable rows={done.slice(0, 5)} /></> : null}
      </div>
    </>
  );
}
