/*
 * The ticket side panel: renderDetail, renderTimeline, relatedHtml,
 * emailsHtml/emailCard/openBtn and openPicker in the single-file edition.
 */
import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { S, P, svc, toast, setView, openDialog } from "../core/state.ts";
import { SEV, STATUSES, ST_LABEL, ACTIVE, CHANNELS, PHASES, SEC_CATS, EV_LABEL, EM_SHORT, AVAIL } from "../core/constants.ts";
import { abs, rel, shortDate, fmtMin, parseMin, plural, localNow } from "../core/format.ts";
import { custOf, custName, isMgr, canRequest, canTake, staffName, staffSorted, mTeams, permBlock, assignBlock, whoText } from "../core/people.ts";
import { sla } from "../core/hours.ts";
import { tgText } from "../core/config.ts";
import {
  setField, assign, addNote, addTimeline, startIncident, changeStatus, takeTicket, reopenForCustomer, noteMins, siteOf, closePanel,
  openTicket,
} from "../core/tickets.ts";
import { routePick, routeTicket } from "../core/routing.ts";
import { lastResolution, composeUrl, setEmail } from "../core/emails.ts";
import { similar } from "../core/similar.ts";
import { evText } from "../core/audit.ts";
import { downloadTimeline } from "../core/exports.ts";
import type { Email, Ticket } from "../core/types.ts";
import { useApp, Ava, Who, Icon, Logo, Tier, CatIcon, StatusChip, Sev, SlaText, Options } from "../ui/index.tsx";

export function TicketPanel({ id }: { id: string }) {
  useApp();
  const t = S.byId.get(id);
  if (!t) return null;
  // Keyed so drafts (note, time, timeline entry) start fresh for each ticket, as openTicket() did.
  return <Panel key={id} t={t} />;
}

function Cell({ l, children }: { l: ReactNode; children: ReactNode }) {
  return <div><span className="lbl" style={{ display: "block", marginBottom: 6 }}>{l}</span><div style={{ lineHeight: 1.4 }}>{children}</div></div>;
}

function gotoCustomer(cid: string, name: string) {
  const c = S.custById.get(cid || "") || S.custByName.get(String(name || "").toLowerCase());
  S.selCust = c ? c.id : null;
  if (!c) S.cuText = name || "";
  setView("customers");
}

function Panel({ t }: { t: Ticket }) {
  const [noteText, setNoteText] = useState("");
  const [noteMin, setNoteMin] = useState("");
  const [noteInternal, setNoteInternal] = useState(() => !!P.noteInternal);
  const [noteBill, setNoteBill] = useState(true);
  const [tl, setTl] = useState({ text: "", phase: "", at: "" });
  const noteRef = useRef<HTMLTextAreaElement>(null), minRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const el = document.getElementById("detail"); if (el) el.scrollTop = 0; }, []);

  const c = custOf(t);
  const ro = !S.canWrite, s = sla(t), isActive = ACTIVE.has(t.status), notes = t.notes || [], hist = (t.history || []).slice().reverse(), mb = noteMins(t);
  const showTl = t.incident || SEC_CATS.has(t.category) || (t.timeline || []).length;
  const con = c && t.contactId ? (c.contacts || []).find((k) => k.id === t.contactId) : null;
  const rn = (con && con.name) || t.requesterName, re = (con && con.email) || t.requesterEmail, rp = (con && con.phone) || t.requesterPhone;
  const assigned = !!(t.assigneeId || t.assigneeLabel);
  const site = siteOf(t);
  const pick = isActive && !assigned && S.cfg.routing.on ? routePick(t) : null;

  const onField = (field: string, v: string) => {
    if (!v) return;
    if (field === "status") changeStatus(t.id, v);
    else setField(t.id, field, v);
  };

  const addNoteNow = () => {
    const tx = noteText.trim(), mins = parseMin(noteMin);
    if (isNaN(mins) || mins > 10000) { toast("Enter the time like 30m, 1h 15m or 1:30.", "worried"); minRef.current?.focus(); return; }
    if (!tx && !mins) { noteRef.current?.focus(); return; }
    setNoteText(""); setNoteMin("");
    addNote(t.id, tx, noteInternal, mins, noteBill);
  };

  const pickerBlocked = !isMgr() && !canRequest() && assigned && t.assigneeId !== S.meId;

  return (
    <>
      <div className="d-top">
        <CatIcon c={t.category} />
        <span className="tid">{t.id + (t.sample ? " / sample" : "")}</span>
        <StatusChip k={t.status} />
        <button className="btn share" data-act="share" title="Share to Teams" onClick={() => openDialog({ kind: "share", id: t.id })}><Icon name="share" /><span className="lg">Share</span></button>
        <button className="x" data-act="close" aria-label="Close ticket" onClick={() => closePanel()}><Icon name="x" /></button>
      </div>
      <h2>{t.subject}</h2>
      <div className="req">
        <Ava uid={null} label={rn || custName(t)} size={40} />
        <div style={{ minWidth: 0 }}>
          <b>{rn || "No contact recorded"}</b>
          {re || rp ? <span className="muted">{[re, rp].filter(Boolean).map((v, i) => <Fragment key={i}>{i ? <br /> : null}{v}</Fragment>)}</span> : null}
          <span className="person">
            <Logo c={c} name={custName(t)} size={20} />
            <button className="linkbtn" style={{ borderBottomColor: "var(--line)" }} data-act="cust-goto" data-cid={c ? c.id : ""} data-name={custName(t)}
              onClick={() => gotoCustomer(c ? c.id : "", custName(t))}>{custName(t)}</button>
            <Tier c={c} />
            {site ? <span className="muted" style={{ display: "inline" }}>{site.name}</span> : null}
          </span>
        </div>
      </div>
      <div className="props">
        <label><span className="lbl">Status</span>
          <select className="field" data-field="status" disabled={ro} value={t.status} onChange={(e) => onField("status", e.target.value)}>
            <Options list={STATUSES.filter((x) => x !== "closing" || t.status === "closing")} label={(o) => (ST_LABEL as any)[o]} />
          </select></label>
        <label><span className="lbl">Severity</span>
          <select className="field" data-field="severity" disabled={ro} value={t.severity} onChange={(e) => onField("severity", e.target.value)}>
            <Options list={Object.keys(SEV)} label={(o) => o + " " + (SEV as any)[o].label} />
          </select></label>
        <label><span className="lbl">Team</span>
          <select className="field" data-field="team" disabled={ro} value={t.team} onChange={(e) => onField("team", e.target.value)}>
            <Options list={S.cfg.teams.includes(t.team) ? S.cfg.teams : S.cfg.teams.concat([t.team])} />
          </select></label>
        <label><span className="lbl">Category</span>
          <select className="field" data-field="category" disabled={ro} value={t.category} onChange={(e) => onField("category", e.target.value)}>
            <Options list={S.cfg.categories.includes(t.category) ? S.cfg.categories : S.cfg.categories.concat([t.category])} />
          </select></label>
        <label><span className="lbl">Channel</span>
          <select className="field" data-field="channel" disabled={ro} value={t.channel || ""} onChange={(e) => onField("channel", e.target.value)}>
            {t.channel ? null : <option value="">Not recorded</option>}
            <Options list={Object.keys(CHANNELS)} label={(o) => (CHANNELS as any)[o]} />
          </select></label>
        <div><span className="lbl" style={{ display: "block", marginBottom: 6 }}>Assignee</span>
          <Picker t={t} disabled={ro || pickerBlocked} blockedTitle={!ro && pickerBlocked ? "Only a manager can reassign this ticket" : undefined} />
        </div>
        <Cell l={"SLA, " + tgText(s.tg) + (s.tg.custom ? ", customer plan" : "")}>
          <SlaText t={t} /><br />
          <span className="muted num">{s.due && !/^Due/.test(s.text) ? "Due " + abs(s.due) : s.due ? "In working time" : s.paused && !t.resolvedAt ? "Clock paused while pending" : "Opened " + abs(t.createdAt)}</span>
        </Cell>
        <Cell l="Time logged">
          {mb[0] ? <>{fmtMin(mb[0])}<br /><span className="muted">{fmtMin(mb[1]) + " billable"}</span></> : <span className="muted">None yet</span>}
        </Cell>
      </div>
      {t.status === "closing" && t.closingUntil ? (
        <div className="note" style={{ margin: "0 0 12px" }}><span>Closing. Anyone can reopen it until <b>{shortDate(new Date(t.closingUntil).getTime())}</b>, then it closes for good.</span></div>
      ) : null}
      {S.canWrite ? (
        <div className="actions">
          {isActive ? <button className="btn primary" data-act="set-status" data-s="resolved" onClick={() => changeStatus(t.id, "resolved")}>Resolve</button> : null}
          {pick ? <button className="btn" data-act="route" title={"Uses the " + t.category + " auto-assign order"} onClick={() => {
            const id = t.id;
            routeTicket(id).then((ok: boolean) => { const x = S.byId.get(id); if (ok && x) toast("Auto-assigned to " + whoText(x.assigneeId, x.assigneeLabel) + ".", "happy"); });
          }}>{"Auto-assign to " + staffName(pick)}</button> : null}
          {isActive && S.meId && t.assigneeId !== S.meId && (isMgr() || !assigned) ? (
            <button className="btn" data-act="take" onClick={() => takeTicket(t.id)}>{canTake(S.meId) ? "Assign to me" : "Clock in and take it"}</button>
          ) : null}
          {t.status === "resolved" ? <>
            <button className="btn dark" data-act="set-status" data-s="closed" onClick={() => changeStatus(t.id, "closed")}>Close</button>
            <button className="btn" data-act="set-status" data-s="open" onClick={() => changeStatus(t.id, "open")}>Reopen</button>
          </> : null}
          {t.status === "closing" ? <>
            <button className="btn" data-act="set-status" data-s="open" onClick={() => changeStatus(t.id, "open")}>Reopen</button>
            <button className="btn" data-act="reopen-cust" onClick={() => reopenForCustomer(t.id)}>Customer asked to reopen</button>
            {isMgr() ? <button className="btn dark" data-act="close-now" onClick={() => changeStatus(t.id, "closed", true)}>Close now</button> : null}
          </> : null}
          {t.status === "closed" ? <button className="btn" data-act="set-status" data-s="open" onClick={() => changeStatus(t.id, "open")}>{canRequest() ? "Ask to reopen" : "Reopen"}</button> : null}
          {!showTl ? <button className="btn" data-act="incident" onClick={() => startIncident(t.id)}>Start incident timeline</button> : null}
        </div>
      ) : null}
      <div className="sect"><span className="lbl">Description</span>
        <div className="desc">{t.description ? t.description : <span className="muted">No description given.</span>}</div>
      </div>
      <Related t={t} />
      <Emails t={t} />
      {showTl ? <Timeline t={t} tl={tl} setTl={setTl} /> : null}
      <div className="sect"><span className="lbl">{"Notes and time (" + notes.length + ")"}</span>
        {notes.map((n, i) => (
          <div className="n" key={i}>
            <Ava uid={n.by} label={n.byLabel || "?"} size={28} />
            <div className="b">
              <div className="hd"><span><b><Who uid={n.by} label={n.byLabel} /></b>{n.text ? (n.internal ? ", internal" : ", customer-visible") : ""}</span><span className="num">{abs(n.at)}</span></div>
              {n.text ? <div className="tx">{n.text}</div> : null}
              {n.minutes ? <div className="timechip"><Icon name="clock" />{fmtMin(n.minutes) + (n.billable ? " billable" : " non-billable")}</div> : null}
            </div>
          </div>
        ))}
        {S.canWrite ? (
          <div className="composer">
            <textarea ref={noteRef} className="field" id="note-t" rows={3} maxLength={6000} placeholder="Add findings, steps taken, or an update" aria-label="New note"
              value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            <div className="rowx">
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <label className="check"><input type="checkbox" id="note-i" checked={noteInternal} onChange={(e) => setNoteInternal(e.target.checked)} />Internal</label>
                <input ref={minRef} className="field" id="note-m" placeholder="Time spent, e.g. 30m" style={{ width: 170 }} aria-label="Time spent" autoComplete="off"
                  value={noteMin} onChange={(e) => setNoteMin(e.target.value)} />
                <label className="check"><input type="checkbox" id="note-b" checked={noteBill} onChange={(e) => setNoteBill(e.target.checked)} />Billable</label>
              </div>
              <button className="btn dark" data-act="note" onClick={addNoteNow}>Add</button>
            </div>
          </div>
        ) : (notes.length ? null : <span className="muted">No notes yet.</span>)}
      </div>
      <div className="sect"><span className="lbl">History</span>
        <ol className="hist">
          {hist.map((e, i) => (
            <li key={i}>
              <time>{abs(e.at)}</time>
              <span>
                {e.type === "created" || e.type === "note" || e.type === "timeline" ? "" : ((EV_LABEL as any)[e.type] || e.type) + ": "}{evText(e)}<br />
                <span className="muted"><Who uid={e.by} label={e.byLabel} /></span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

/** The assignee picker (openPicker). */
function Picker({ t, disabled, blockedTitle }: { t: Ticket; disabled: boolean; blockedTitle?: string }) {
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<any[]>([]);
  const wrap = useRef<HTMLDivElement>(null), inp = useRef<HTMLInputElement>(null);
  const mgr = isMgr(), req = canRequest();
  const searchable = mgr && svc.user && typeof svc.user.search === "function";

  const remember = (list: any[]) => {
    // Cache names and photos for people found by search, as the single-file edition did, so <Who/> can show them.
    for (const h of list || []) { S.names[h.id] = h.name; if (h.avatarUrl) S.avatars[h.id] = h.avatarUrl; }
    setHits(list || []);
  };
  const search = async (v: string) => { try { remember(await svc.user.search(v)); } catch { /* keep the last results */ } };

  useEffect(() => {
    if (!open) return;
    if (searchable) { inp.current?.focus(); search(""); }
    const onDoc = (e: MouseEvent) => { if (!(e.target as Element).closest?.(".picker")) setOpen(false); };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); } };

  const opts: ReactNode[] = [];
  const opt = (label: string, uid: string | null, lab: string | null) => {
    const needs = req && permBlock(t, uid, lab), why = needs ? null : assignBlock(t, uid, lab), off = (uid || lab) && !canTake(uid, lab);
    opts.push(
      <button key={opts.length} className="opt" disabled={!!why} title={why || undefined}
        onClick={() => { setOpen(false); assign(t.id, uid, lab); }}>
        {label + (needs ? " (ask a manager)" : off ? " (off shift)" : "")}
      </button>,
    );
  };
  if (open) {
    const seen = new Set<string>();
    if (S.meId && t.assigneeId !== S.meId && (mgr || req || !(t.assigneeId || t.assigneeLabel))) { seen.add(S.meId); opt("Assign to me", S.meId, null); }
    if (mgr || req) {
      for (const m of staffSorted()) {
        if (m.uid && (seen.has(m.uid) || m.uid === t.assigneeId)) continue;
        if (!m.uid && m.label === t.assigneeLabel) continue;
        if (m.uid) seen.add(m.uid);
        opt(staffName(m) + (m.avail && m.avail !== "available" ? ", " + String((AVAIL as any)[m.avail] || m.avail).toLowerCase() : "") + (mTeams(m).length ? " (" + mTeams(m).join(", ") + ")" : ""), m.uid, m.label);
      }
      if (mgr) hits.filter((h) => !seen.has(h.id) && h.id !== t.assigneeId).forEach((h) => opt(h.name, h.id, null));
    }
    if (t.assigneeId || t.assigneeLabel) opt("Unassign", null, null);
  }
  const list = (
    <div>
      {opts}
      {!mgr ? <p className="hint">{req ? "Changes involving other people go to a manager for approval." : "Only managers can assign tickets to other people."}</p> : null}
    </div>
  );
  const assigned = !!(t.assigneeId || t.assigneeLabel);
  return (
    <div className="picker" ref={wrap} onKeyDown={onKeyDown}>
      <button className="field" data-act="pick" disabled={disabled} title={blockedTitle} aria-haspopup="listbox" onClick={() => setOpen((o) => !o)}>
        {assigned ? <><Ava uid={t.assigneeId} label={t.assigneeLabel} size={20} /><span><Who uid={t.assigneeId} label={t.assigneeLabel} /></span></> : "Unassigned"}
      </button>
      <div className="pop" id="pop" hidden={!open}>
        {open ? <>
          {searchable ? <input ref={inp} className="field" placeholder="Search people" aria-label="Search people" onChange={(e) => search(e.target.value)} /> : null}
          {list}
        </> : null}
      </div>
    </div>
  );
}

/** simRow(t, cid, true) */
function SimRow({ t, cid }: { t: Ticket; cid: string | null }) {
  const res = lastResolution(t) || ((t.notes || []).filter((n) => n.text).slice(-1)[0] || ({} as any)).text || "";
  const c = custOf(t), dup = ACTIVE.has(t.status) && cid && c && c.id === cid;
  return (
    <div className="sim">
      <CatIcon c={t.category} />
      <div className="meta">
        <b><button className="linkbtn" style={{ borderBottomColor: "var(--line)", fontWeight: 500 }} data-act="open" data-id={t.id} onClick={() => openTicket(t.id)}>{t.subject}</button></b>
        <span>{t.id + ", " + custName(t) + ", " + rel(t.createdAt)}<StatusChip k={t.status} />{dup ? <span className="dup">Still open for this customer</span> : null}</span>
        {res ? <span className="res">{res.length > 180 ? res.slice(0, 180) + "…" : res}</span> : null}
      </div>
    </div>
  );
}

/** relatedHtml(t) */
function Related({ t }: { t: Ticket }) {
  const list = similar((t.subject || "") + " " + (t.description || ""), { exclude: t.id, customerId: t.customerId, category: t.category, limit: 4 });
  if (!list.length) return null;
  return <div className="sect"><span className="lbl">Related tickets</span>{list.map((x: any) => <SimRow key={x.t.id} t={x.t} cid={t.customerId} />)}</div>;
}

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

/** emailCard(t, m) */
function EmailCard({ t, m }: { t: Ticket; m: Email }) {
  const short = (EM_SHORT as any)[m.event] || "email";
  return (
    <div className="em">
      <div className="em-h">
        <b>{m.subject}</b>
        {m.to ? <span className="muted">{short + ", to " + m.to}</span>
          : <><span className="muted">{short + ", to "}</span><span className="breach">no email address on file</span><span className="muted"></span></>}
      </div>
      <details><summary>Preview</summary><div className="em-body">{m.body}</div></details>
      {S.canWrite ? (
        <div className="actions">
          <OpenBtn m={m} />
          <button className="btn" data-act="em-sent" data-t={t.id} data-m={m.id} onClick={() => setEmail(t.id, m.id, "sent")}>Mark as sent</button>
          <button className="btn" data-act="em-skip" data-t={t.id} data-m={m.id} onClick={() => setEmail(t.id, m.id, "skipped")}>Skip</button>
        </div>
      ) : null}
    </div>
  );
}

/** emailsHtml(t) */
function Emails({ t }: { t: Ticket }) {
  const ems = t.emails || [];
  if (!ems.length) return null;
  const pend = ems.filter((m) => m.status === "pending"), done = ems.filter((m) => m.status !== "pending");
  return (
    <div className="sect"><span className="lbl">{"Emails to the customer" + (pend.length ? " (" + pend.length + " to send)" : "")}</span>
      {pend.map((m) => <EmailCard key={m.id} t={t} m={m} />)}
      {done.length ? (
        <details className="emdone" open={!pend.length}>
          <summary>{plural(done.length, "earlier email")}</summary>
          {done.map((m) => (
            <div className="emline" key={m.id}>
              {(m.status === "sent" ? "Sent" : "Skipped") + ": " + m.subject}
              {m.doneBy ? <>{", "}<Who uid={m.doneBy} label={null} /></> : null}
              {m.doneAt ? ", " + abs(m.doneAt) : ""}
            </div>
          ))}
        </details>
      ) : null}
    </div>
  );
}

type TlDraft = { text: string; phase: string; at: string };

/** renderTimeline(t) */
function Timeline({ t, tl, setTl }: { t: Ticket; tl: TlDraft; setTl: (v: TlDraft) => void }) {
  const txRef = useRef<HTMLTextAreaElement>(null);
  const en = (t.timeline || []).slice().sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
  const idx = en.reduce((m, e) => Math.max(m, PHASES.indexOf(e.phase as string)), -1);
  const phase = tl.phase || PHASES[Math.max(0, idx)];
  const dl = en.length && svc.downloads
    ? <button className="btn" data-act="tl-dl" onClick={() => downloadTimeline()}><Icon name="dl" />Download timeline</button> : null;
  const add = () => {
    const tx = tl.text.trim(), at = tl.at || localNow(), d = at ? new Date(at) : new Date();
    if (!tx) { txRef.current?.focus(); return; }
    if (isNaN(d.getTime())) { toast("Pick when it happened.", "worried"); return; }
    setTl({ text: "", phase, at: "" });
    addTimeline(t.id, { at: d.toISOString(), phase, text: tx });
  };
  return (
    <div className="sect"><span className="lbl">Incident timeline</span>
      <div className="phases">{PHASES.map((p, i) => <span key={p} className={i < idx ? "done" : i === idx ? "now" : ""}>{p}</span>)}</div>
      {en.length ? (
        <ol className="tl">
          {en.map((e, i) => (
            <li key={e.id || i}>
              <div className="hd"><b>{e.phase}</b><span className="num">{abs(e.at)}</span><span><Who uid={e.by} label={e.byLabel} /></span></div>
              <div className="tx">{e.text}</div>
            </li>
          ))}
        </ol>
      ) : <p className="muted" style={{ marginBottom: 8 }}>No entries yet. Start with when and how the issue was detected.</p>}
      {S.canWrite ? (
        <div className="subform">
          <label><span className="lbl">Phase</span>
            <select className="field" id="tl-p" value={phase} onChange={(e) => setTl({ ...tl, phase: e.target.value })}><Options list={PHASES} /></select></label>
          <label><span className="lbl">When it happened</span>
            <input className="field" type="datetime-local" id="tl-at" value={tl.at || localNow()} onChange={(e) => setTl({ ...tl, at: e.target.value })} /></label>
          <label className="full"><span className="lbl">What happened</span>
            <textarea ref={txRef} className="field" id="tl-t" rows={2} maxLength={4000} placeholder="e.g. EDR alert on PC-114, user confirmed opening the attachment"
              value={tl.text} onChange={(e) => setTl({ ...tl, text: e.target.value })} /></label>
          <div className="full actions">{dl}<button className="btn dark" data-act="tl-add" onClick={add}>Add entry</button></div>
        </div>
      ) : dl ? <div className="actions">{dl}</div> : null}
    </div>
  );
}
