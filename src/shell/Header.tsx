/*
 * The top bar: brand, tabs, shift box, New ticket, the bell, settings and
 * profile menus (renderChrome and renderBell in the single-file edition).
 * Also installs squishy Ping and the global keyboard shortcuts.
 */
import { useEffect, useState, type ReactNode } from "react";
import { S, P, ref, commit, openDialog, setView, toast, type View } from "../core/state.ts";
import { mascot } from "../core/art.ts";
import { SKINS, CH_FIELDS } from "../core/constants.ts";
import { dur, hm, rel } from "../core/format.ts";
import { setPref, effectiveSkin, systemDark } from "../core/prefs.ts";
import { photoOf, isMgr, shiftOf } from "../core/people.ts";
import { clockOut, setShift, openTicket, closePanel } from "../core/tickets.ts";
import { resetFilters } from "../core/queue.ts";
import { allRequests, myRequests, seenSet, safePhoto, chValue, decide } from "../core/requests.ts";
import { maybeSetup } from "../core/setup.ts";
import { useApp, Icon, Ava, Who } from "../ui/index.tsx";
import { installSquish } from "./squish.ts";

const TABS: [View, string][] = [
  ["queue", "Queue"], ["mine", "My desk"], ["dispatch", "Dispatch"], ["history", "History"],
  ["customers", "Customers"], ["reports", "Reports"], ["audit", "Audit log"],
];

/** Mark your answered requests as seen (helpdesk.reqSeen), so the bell stops counting them. */
export function markRequestsSeen(): void {
  const all = new Set([...seenSet(), ...myRequests().filter((r: any) => r.status !== "pending").map((r: any) => r.id)]);
  try { localStorage.setItem("helpdesk.reqSeen", JSON.stringify([...all].slice(-200))); } catch (e) { /* no storage */ }
}

/** The "goto" action: show a ticket in the Queue with every filter cleared. */
function gotoTicket(id: string) {
  resetFilters();
  S.q.status = "all";
  setView("queue");
  openTicket(id);
  window.scrollTo(0, 0);
}

/** reqText(r, true): what a request asks for, with the ticket as a link and names as <Who/>. */
export function ReqText({ r }: { r: any }) {
  const t = r.ticketId ? S.byId.get(r.ticketId) : null;
  const tl: ReactNode = r.ticketId
    ? <button className="linkbtn tid" style={{ borderBottomColor: "var(--line)" }} data-act="goto" data-id={r.ticketId} onClick={() => gotoTicket(r.ticketId)}>{r.ticketId}</button>
    : null;
  const subj = t ? " (" + t.subject.slice(0, 60) + ")" : "";
  switch (r.type) {
    case "assign": {
      const self = r.to === r.uid, from = !!(r.from || r.fromLabel);
      return <>{self ? "asks to take " : "asks to assign "}{tl}{self ? null : <>{" to "}<Who uid={r.to} label={r.toLabel} /></>}
        {from && !self ? <>{", currently with "}<Who uid={r.from} label={r.fromLabel} /></> : from ? <>{" from "}<Who uid={r.from} label={r.fromLabel} /></> : null}{subj}</>;
    }
    case "unassign":
      return <>{"asks to unassign "}{tl}{r.from || r.fromLabel ? <>{" from "}<Who uid={r.from} label={r.fromLabel} /></> : null}{subj}</>;
    case "photo": return <>asks for a new profile photo</>;
    case "reopen": return <>{"asks to reopen "}{tl}{subj}</>;
    case "reorder": {
      const ownr: ReactNode = (r.colUid || r.colLabel) ? (r.colUid === r.uid ? "their" : <><Who uid={r.colUid} label={r.colLabel} />{"'s"}</>) : "the Unassigned";
      return <>{"asks to move "}{tl}{" to position " + (r.pos || "?") + " in "}{ownr}{" list"}{subj}</>;
    }
    case "change":
      return <>{r.field === "other" ? "asks for a change" : "asks to change their " + (((CH_FIELDS as any)[r.field]) || "details").toLowerCase() + " to " + chValue(r)}</>;
    default: return <>has a request</>;
  }
}

/** reqRow(r, acts): one request with its status, and Approve/Decline for managers when `acts`. */
export function ReqRow({ r, acts, decline, setDecline }: { r: any; acts?: boolean; decline?: string | null; setDecline?: (id: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const pill = r.status === "approved" ? <span className="pill ok">Approved</span> : r.status === "declined" ? <span className="pill no">Declined</span> : <span className="pill wait">Waiting</span>;
  const ph = r.type === "photo" ? safePhoto(r.photo) : null;
  const approve = async () => { setBusy(true); try { await decide(r.uid, r.id, true); } finally { setBusy(false); } };
  const declineGo = async () => { const ok = await decide(r.uid, r.id, false, reason.trim().slice(0, 200)); if (ok) { if (setDecline) setDecline(null); toast("Declined."); } };
  return (
    <div className="rq"><div className="rq-top"><Ava uid={r.uid} size={30} /><div className="rq-main">
      <div className="rq-line"><b><Who uid={r.uid} /></b> <ReqText r={r} /></div>
      <div className="rq-meta">{pill}<span>{rel(r.at)}</span>{r.dec && r.dec.by ? <span>by <Who uid={r.dec.by} /></span> : null}</div>
      {r.note ? <div className="rq-note">{r.note}</div> : null}
      {ph ? <img className="rq-photo" alt="Requested photo" src={ph} /> : null}
      {r.dec && r.dec.reason ? <div className="rq-note" style={{ background: "color-mix(in srgb,var(--warn) 8%,var(--bg))" }}>{r.dec.reason}</div> : null}
      {acts && r.status === "pending" ? (decline === r.id
        ? <div className="rq-acts"><input className="field" id={"rqd-" + r.id} maxLength={200} placeholder="Reason (optional)" aria-label="Reason for declining" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn" data-act="rq-no-cancel" onClick={() => setDecline && setDecline(null)}>Back</button>
          <button className="btn dark" data-act="rq-no-go" data-id={r.id} onClick={declineGo}>Decline</button></div>
        : <div className="rq-acts"><button className="btn primary" data-act="rq-yes" data-id={r.id} disabled={busy} onClick={approve}>Approve</button>
          <button className="btn" data-act="rq-no" data-id={r.id} onClick={() => { setReason(""); if (setDecline) setDecline(r.id); }}>Decline</button></div>) : null}
    </div></div></div>
  );
}

type MenuId = "m-bell" | "m-settings" | "m-profile" | null;

export function Header() {
  useApp();
  const [menu, setMenu] = useState<MenuId>(null);
  const [rqDecline, setRqDecline] = useState<string | null>(null);
  const mgr = isMgr(), signed = !!S.meId, db = ref.db;
  const view: View = S.view === "admin" && !mgr ? "queue" : S.view;

  /* squishy Ping */
  useEffect(() => installSquish(), []);

  /* (the 30-second re-render for the shift timer comes from boot() in data.ts) */

  /* tab title */
  useEffect(() => { if (S.cfg && document.title !== S.cfg.name) document.title = S.cfg.name; });

  /* the single-file edition checks for first-run setup at the end of every refresh() */
  useEffect(() => { maybeSetup(); });

  /* clicking anywhere outside a menu closes the menus */
  useEffect(() => {
    const onClick = (e: MouseEvent) => { const t = e.target as Element | null; if (!(t && t.closest && t.closest(".menu-wrap"))) setMenu(null); };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  /* keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || ""), modal = !!S.dialog;
      if (e.key === "Enter" && target.classList && (target.classList.contains("row") || target.classList.contains("tk")) && target.dataset.id) { openTicket(target.dataset.id); return; }
      if (e.key === "Escape" && !modal) {
        if (document.querySelector(".menu:not([hidden])")) { setMenu(null); return; }
        const pop = document.getElementById("pop"); if (pop && !pop.hidden) return; // the ticket panel's picker closes itself first
        if (!typing && (S.sel || S.selCust)) closePanel();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || modal) return;
      if (e.key === "/" && (S.view === "queue" || S.view === "audit" || S.view === "history")) {
        e.preventDefault();
        const el = document.getElementById(({ audit: "a-text", history: "h-text" } as Record<string, string>)[S.view] || "q-text");
        if (el) el.focus();
      } else if (e.key === "n" && S.canWrite) { e.preventDefault(); setMenu(null); openDialog({ kind: "newTicket" }); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const toggle = (id: Exclude<MenuId, null>) => setMenu((m) => (m === id ? null : id));
  const goView = (v: View, ad?: string) => { setMenu(null); if (ad) S.adTab = ad; setView(v); };
  const clockIn = () => { setMenu(null); setShift(S.meId, null, true).then((ok: any) => { if (ok) toast("You're clocked in. Tickets can be assigned to you now.", "happy"); }); };
  const doClockOut = () => { setMenu(null); clockOut(); };
  const account = () => { setMenu(null); openDialog({ kind: "account", tab: "profile" }); };

  /* profile button */
  const myPh = photoOf(S.meId, null);
  const profIcon = myPh ? <img alt="" src={"/_blob/" + myPh} /> : S.meAvatar ? <img alt="" src={S.meAvatar} /> : <Icon name="user" />;

  /* shift */
  const role = !S.canWrite ? "View only" : !db ? "Full access in this browser" : mgr ? (S.isOwner ? "Owner, manager" : "Manager") : "Agent";
  const shiftOn = !!(S.cfg.requireShift && db && signed && S.canWrite), me = shiftOn ? shiftOf(S.meId, null) : null, on = !!(me && me.on);

  /* bell */
  const bellOn = !!(db && S.meId);
  const all = bellOn ? allRequests() : [], pend = all.filter((r: any) => r.status === "pending"), mine = all.filter((r: any) => r.uid === S.meId), seen = bellOn ? seenSet() : new Set();
  const n = mgr ? pend.length : mine.filter((r: any) => r.status !== "pending" && !seen.has(r.id)).length;
  const openBell = () => {
    const opening = menu !== "m-bell";
    toggle("m-bell");
    if (opening && !mgr) setTimeout(() => { markRequestsSeen(); commit(); }, 1500);
  };

  /* themes */
  const eff = effectiveSkin();
  const skins = (kind: string, key: "lightTheme" | "darkTheme") => (SKINS as any[]).filter((x) => x[4] === kind).map((x) => (
    <button key={x[0]} className="skin" data-act="pref" data-k={key} data-val={x[0]} aria-pressed={P[key] === x[0]} onClick={() => setPref(key, x[0])}>
      <span className="sw" style={{ background: x[2] }}><i style={{ background: x[3] }} /></span>
      <span className="nm">{x[1]}{eff === x[0] ? <small>In use now</small> : null}</span>
    </button>
  ));
  const cur = (SKINS as any[]).find((x) => x[0] === eff);
  const modeHint = P.mode === "system"
    ? "Your system is in " + (systemDark() ? "dark" : "light") + " mode, so " + (cur ? cur[1] : "") + " is in use. The helpdesk switches automatically when your system does."
    : "Pick a theme for each mode below.";
  const pill = (k: string, val: string, label: string) => (
    <button data-act="pref" data-k={k} data-val={val} aria-pressed={P[k] === val} onClick={() => setPref(k, val)}>{label}</button>
  );
  const sw = (k: string, label: string) => (
    <label className="switch"><span>{label}</span><input type="checkbox" data-pref={k} checked={!!P[k]} onChange={(e) => setPref(k, e.target.checked)} /></label>
  );

  return (
    <header className="bar"><div className="bar-in">
      <div className="brand" id="brand">
        {P.mascot ? <span className="squishy" id="brand-m" role="button" tabIndex={0} aria-label="Squish Ping" title="Squish me" dangerouslySetInnerHTML={{ __html: mascot("happy") }} /> : null}
        <span>{S.cfg.name}</span>
      </div>
      <nav className="tabs" aria-label="Sections">
        {TABS.map(([v, label]) => (
          <button key={v} data-act="view" data-v={v} aria-current={view === v ? "page" : undefined} onClick={() => goView(v)}>{label}</button>
        ))}
        <button data-act="view" data-v="admin" id="tab-admin" hidden={!mgr} aria-current={view === "admin" ? "page" : undefined} onClick={() => goView("admin")}>Admin</button>
      </nav>
      <div className="bar-right">
        <div className="shiftbox" id="shiftbox">
          {!shiftOn ? null : on
            ? <><span className="shift-time"><span className="dot ok" />On shift {dur(Date.now() - new Date(me!.since!).getTime())}</span><button className="btn" data-act="clock-out" onClick={doClockOut}>Clock out</button></>
            : <button className="btn" data-act="clock-in" onClick={clockIn}><span className="dot" />Clock in</button>}
        </div>
        <button className="btn primary new" data-act="new" id="btn-new" hidden={!S.canWrite} onClick={() => { setMenu(null); openDialog({ kind: "newTicket" }); }}>
          <Icon name="plus" /><span className="lg">New ticket</span>
        </button>
        <div className="menu-wrap bellwrap" id="bell-wrap" hidden={!bellOn}>
          <button className="iconbtn" data-act="bell" aria-haspopup="true" id="b-bell" onClick={openBell}
            aria-label={(mgr ? "Requests waiting" : "Your requests") + (n ? ", " + n + (mgr ? " waiting" : " updated") : "")}><Icon name="bell" /></button>
          <span className="bell-n" id="bell-n" hidden={!n}>{n > 99 ? "99+" : String(n)}</span>
          <div className="menu wide" id="m-bell" hidden={menu !== "m-bell"}>
            {menu !== "m-bell" ? null : mgr ? <>
              <h3>Requests{pend.length ? " (" + pend.length + ")" : ""}</h3>
              {pend.length ? pend.slice(0, 10).map((r: any) => <ReqRow key={r.id} r={r} acts decline={rqDecline} setDecline={setRqDecline} />)
                : <p className="muted">Nothing waiting. Agents' requests for changes only managers can make will show up here.</p>}
              <div className="grp"><button className="btn" style={{ width: "100%", justifyContent: "center" }} data-act="view" data-v="admin" data-ad="requests" onClick={() => goView("admin", "requests")}>See all requests</button></div>
            </> : <>
              <h3>Your requests</h3>
              {mine.length ? mine.slice(0, 10).map((r: any) => <ReqRow key={r.id} r={r} />)
                : <p className="muted">When you ask a manager for something, you'll see the answer here.</p>}
            </>}
          </div>
        </div>
        <div className="menu-wrap">
          <button className="iconbtn" data-act="menu" data-m="m-settings" aria-label="Settings" aria-haspopup="true" id="b-settings" onClick={() => toggle("m-settings")}><Icon name="gear" /></button>
          <div className="menu" id="m-settings" hidden={menu !== "m-settings"}>
            <h3>Make it yours</h3>
            <span className="lbl">Appearance</span>
            <div className="pills" id="modes" role="group" aria-label="Appearance">{pill("mode", "light", "Light")}{pill("mode", "dark", "Dark")}{pill("mode", "system", "System")}</div>
            <p className="mode-hint" id="mode-hint">{modeHint}</p>
            <div className="grp"><span className="lbl">Light theme</span><div className="skins" id="skins-l">{skins("light", "lightTheme")}</div></div>
            <div className="grp"><span className="lbl">Dark theme</span><div className="skins" id="skins-d">{skins("dark", "darkTheme")}</div></div>
            <div className="grp"><span className="lbl">Row spacing</span>
              <div className="pills" id="dens">{pill("density", "cosy", "Cosy")}{pill("density", "compact", "Compact")}</div></div>
            <div className="grp">
              {sw("mascot", "Show Ping, the mascot")}
              {sw("squeak", "Squeak when you squish Ping")}
              {sw("avatars", "Show avatars and category icons")}
              {sw("exact", "Show exact times instead of \"2h ago\"")}
            </div>
            <div className="grp" id="g-admin" hidden={!mgr}><button className="btn" style={{ width: "100%", justifyContent: "center" }} data-act="view" data-v="admin" onClick={() => goView("admin")}>Open admin</button></div>
          </div>
        </div>
        <div className="menu-wrap">
          <button className="iconbtn" data-act="menu" data-m="m-profile" aria-label="Your account" aria-haspopup="true" id="b-profile" onClick={() => toggle("m-profile")}>{profIcon}</button>
          <div className="menu" id="m-profile" hidden={menu !== "m-profile"}>
            <div className="who-card"><span className="av" style={{ "--s": "44px" } as any}>{S.meAvatar ? <img alt="" src={S.meAvatar} /> : <Icon name="user" />}</span>
              <div><b id="me-name">{S.meName || (signed ? "You" : "Guest")}</b><span className="muted">{signed || !db ? role : S.mode === "connecting" ? "Checking who you are" : "Not signed in"}</span></div></div>
            {shiftOn ? <div className="grp"><span className="lbl">Shift</span>
              <p style={{ margin: "0 0 8px" }}>{on ? "Clocked in at " + hm(me!.since!) + "." : "You're clocked out, so you can't take new tickets."}</p>
              <button className={"btn" + (on ? "" : " primary")} style={{ width: "100%", justifyContent: "center" }} data-act={on ? "clock-out" : "clock-in"} onClick={on ? doClockOut : clockIn}>{on ? "Clock out" : "Clock in"}</button></div> : null}
            {mgr && db ? <div className="grp"><button className="btn" style={{ width: "100%", justifyContent: "center" }} data-act="view" data-v="admin" onClick={() => goView("admin")}>Open admin</button></div> : null}
            <div className="grp"><button className="btn" style={{ width: "100%", justifyContent: "center" }} data-act="account" onClick={account}>Account settings</button></div>
            <p className="small">{signed ? "You're signed in through your organisation's sign-in, so there's no separate helpdesk password. To sign out or switch accounts, use your sign-in system." : "No sign-in is connected, so changes here aren't recorded under anyone's name."}</p>
          </div>
        </div>
      </div>
    </div></header>
  );
}
