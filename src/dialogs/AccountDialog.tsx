/*
 * Account settings (#acct: openAccount, renderAccount, renderChForm, chNext).
 * Tabs: profile, prefs, notify, security, reqs. The tab you were last on is
 * remembered for the session, like S.acctTab in the single-file edition.
 */
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { S, P, svc, ref, commit, closeDialog, setView, toast } from "../core/state.ts";
import { AVAIL, CH_FIELDS } from "../core/constants.ts";
import { setPref } from "../core/prefs.ts";
import { photoOf, isMgr, staffOf, mTeams, canRequest } from "../core/people.ts";
import { myRequests, openRequest } from "../core/requests.ts";
import { resizePhoto, uploadStaffPhoto } from "../core/staff.ts";
import { useApp, Dialog, Icon, Options } from "../ui/index.tsx";
import { ReqRow, markRequestsSeen } from "../shell/Header.tsx";
import type { Staff } from "../core/types.ts";

const TABS: [string, string][] = [["profile", "Profile"], ["prefs", "Preferences"], ["notify", "Notifications"], ["security", "Sign-in and security"], ["reqs", "Requests"]];
let lastTab = "profile";

/** The "Request a change" form under the profile (renderChForm and chNext). */
function ChForm({ field, me, onCancel }: { field: string; me: Staff; onCancel: () => void }) {
  const [v, setV] = useState(field === "title" ? me.title || "" : field === "m365" ? me.m365 || "" : field === "avail" ? me.avail || "available" : "");
  const [oc, setOc] = useState(!!me.oncall);
  const [teams, setTeams] = useState<string[]>(() => S.cfg.teams.filter((t) => mTeams(me).includes(t)));
  const [err, setErr] = useState("");
  const label = ((CH_FIELDS as any)[field] || "").toLowerCase();

  const next = () => {
    let value: any = null;
    if (field === "title") { value = v.trim(); if (!value) { setErr("Enter the new job title."); return; } }
    else if (field === "m365") { value = v.trim(); if (!/^\S+@\S+\.\S+$/.test(value)) { setErr("Enter a full email address."); return; } }
    else if (field === "teams") { value = S.cfg.teams.filter((t) => teams.includes(t)); }
    else if (field === "avail") {
      value = v;
      const m = staffOf(S.meId, null);
      if (m && oc !== !!m.oncall && value === (m.avail || "available")) { openRequest({ type: "change", field: "oncall", value: oc }); return; }
    }
    openRequest({ type: "change", field, value });
  };

  let ctl: ReactNode = null;
  if (field === "title") ctl = <input className="field" id="ch-v" maxLength={60} autoComplete="off" autoFocus value={v} onChange={(e) => setV(e.target.value)} />;
  else if (field === "m365") ctl = <input className="field" id="ch-v" type="email" maxLength={120} placeholder="name@yourcompany.com" autoComplete="off" autoFocus value={v} onChange={(e) => setV(e.target.value)} />;
  else if (field === "avail") ctl = <><select className="field" id="ch-v" autoFocus value={v} onChange={(e) => setV(e.target.value)}><Options list={Object.keys(AVAIL)} label={(k) => (AVAIL as any)[k]} /></select>
    <label className="check" style={{ marginTop: 8 }}><input type="checkbox" id="ch-oc" checked={oc} onChange={(e) => setOc(e.target.checked)} />On call</label></>;
  else if (field === "teams") ctl = <div className="teamchecks">{S.cfg.teams.map((t) => (
    <label key={t} className="check"><input type="checkbox" className="ch-team" value={t} checked={teams.includes(t)}
      onChange={(e) => setTeams((l) => (e.target.checked ? l.concat([t]) : l.filter((x) => x !== t)))} />{t}</label>))}</div>;

  return (
    <div className="subform" style={{ gridTemplateColumns: "1fr", marginTop: 16 }}>
      <b style={{ fontWeight: 600 }}>{field === "other" ? "Ask a manager for something else" : "Request a change to your " + label}</b>
      {ctl ? <div><span className="lbl" style={{ display: "block", marginBottom: 6 }}>{field === "other" ? "" : "New " + label}</span>{ctl}</div> : null}
      <p className="muted" style={{ fontSize: 12.5 }}>{field === "other" ? "Describe it in the next step." : "You can add a note for the manager in the next step."}</p>
      <div className="err" id="ch-err">{err}</div>
      <div className="actions"><button className="btn" data-act="ch-cancel" onClick={onCancel}>Cancel</button><button className="btn primary" data-act="ch-next" onClick={next}>Continue</button></div>
    </div>
  );
}

export function AccountDialog({ tab }: { tab?: string }) {
  useApp();
  const [cur, setCur] = useState(() => (lastTab = tab || lastTab || "profile"));
  const [ch, setCh] = useState<{ field: string; n: number } | null>(null);

  useEffect(() => { if (cur === "reqs") { markRequestsSeen(); commit(); } }, [cur]);

  const pickTab = (t: string) => { lastTab = t; setCur(t); setCh(null); };
  const openCh = (f: string) => setCh((c) => ({ field: f, n: (c ? c.n : 0) + 1 }));

  const db = ref.db, mgr = isMgr(), me = S.meId ? staffOf(S.meId, null) : null, req = canRequest();
  const role = !S.canWrite ? "View only" : !db ? "Full access in this browser" : mgr ? "Manager" : "Agent";
  const ph = photoOf(S.meId, null);
  const reqBtn = (f: string, l?: string) => (req && me ? <> <button className="linkbtn" style={{ fontSize: 12.5, marginLeft: 8 }} data-act="ch-open" data-f={f} onClick={() => openCh(f)}>{l || "Request a change"}</button></> : null);

  const onReqPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (f) resizePhoto(f).then((photo: any) => openRequest({ type: "photo", photo })).catch(() => toast("That image couldn't be read. Try a PNG or JPG.", "worried"));
  };
  const onMyPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    uploadStaffPhoto(staffOf(S.meId, null), f); e.target.value = "";
  };
  const toAdmin = () => { closeDialog(); S.adTab = "agents"; setView("admin"); };

  const prefSel = (k: string) => ({
    "data-prefsel": k,
    value: typeof P[k] === "boolean" ? (P[k] ? "1" : "") : P[k],
    onChange: (e: ChangeEvent<HTMLSelectElement>) => setPref(k, typeof P[k] === "boolean" ? e.target.value === "1" : e.target.value),
  });
  const sw = (k: string, label: string, id?: string, hidden?: boolean) => (
    <label className="switch" id={id} hidden={hidden}><span>{label}</span><input type="checkbox" data-pref={k} checked={!!P[k]} onChange={(e) => setPref(k, e.target.checked)} /></label>
  );
  const mine = myRequests();

  return (
    <Dialog id="acct" className="dlg mid" labelledBy="acct-h" onClose={closeDialog}>
      <div className="d-top"><span className="lbl">Account settings</span><button className="x" data-act="acct-close" aria-label="Close" onClick={closeDialog}><Icon name="x" /></button></div>
      <h2 id="acct-h">Your account</h2>
      <div className="seg" id="acct-tabs" role="group" aria-label="Account sections" style={{ margin: "12px 0 16px" }}>
        {TABS.map(([t, l]) => <button key={t} data-act="acct-tab" data-t={t} aria-pressed={cur === t} onClick={() => pickTab(t)}>{l}</button>)}
      </div>

      <section data-acct="profile" hidden={cur !== "profile"}>
        <div id="acct-profile">
          <div className="prof"><span className="av" style={{ "--s": "72px" } as any}>{ph ? <img alt="" src={"/_blob/" + ph} /> : S.meAvatar ? <img alt="" src={S.meAvatar} /> : <Icon name="user" />}</span>
            <div><b id="acct-name">{S.meName || (S.meId ? "You" : "Guest")}</b><span className="muted">{role + (me && me.title ? ", " + me.title : "")}</span></div></div>
          {me ? <>
            <dl className="kv">
              <dt>Office 365 account</dt><dd>{me.m365 ? me.m365 : <span className="muted">Not linked yet</span>}{reqBtn("m365", me.m365 ? "Request a change" : "Ask to link it")}</dd>
              <dt>Job title</dt><dd>{me.title || "Not set"}{reqBtn("title")}</dd>
              <dt>Teams</dt><dd>{mTeams(me).join(", ") || "No team"}{reqBtn("teams")}</dd>
              <dt>Availability</dt><dd>{(AVAIL as any)[me.avail || "available"]}{me.oncall ? ", on call" : ""}{reqBtn("avail")}</dd>
              <dt>Profile photo</dt><dd>{ph ? "Set by a manager" : "Using your sign-in photo"}
                {req ? <> <label className="linkbtn" style={{ fontSize: 12.5, marginLeft: 8 }}>Request a new photo<input type="file" accept="image/png,image/jpeg,image/webp" data-act-file="reqphoto" hidden onChange={onReqPhoto} /></label></> : null}
                {mgr && svc.assets ? <> <label className="linkbtn" style={{ fontSize: 12.5, marginLeft: 8 }}>Change photo<input type="file" accept="image/png,image/jpeg,image/webp" data-act-file="myphoto" hidden onChange={onMyPhoto} /></label></> : null}</dd>
            </dl>
            {mgr ? <div className="actions" style={{ marginTop: 14 }}><button className="btn" data-act="acct-admin" onClick={toAdmin}>Edit my details in Admin</button></div>
              : req ? <><div className="actions" style={{ marginTop: 14 }}><button className="btn" data-act="ch-open" data-f="other" onClick={() => openCh("other")}>Ask for something else</button></div>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Your profile is managed by your managers, so changes go to them for approval.</p></> : null}
          </> : <div className="note"><span>{db && S.meId ? "You're not set up as an agent yet. Ask a manager to add you under Admin, Agents." : "Profiles need the helpdesk to be connected to your organisation's sign-in."}</span></div>}
        </div>
        <div id="acct-reqform">{ch && me && cur === "profile" ? <ChForm key={ch.field + ch.n} field={ch.field} me={me} onCancel={() => setCh(null)} /> : null}</div>
      </section>

      <section data-acct="prefs" hidden={cur !== "prefs"}>
        <p className="muted" id="acct-sub" style={{ marginBottom: 12 }}>{S.meId && db ? "These follow you to any device you open the helpdesk on." : "These are saved in this browser."}</p>
        <div className="form" style={{ gridTemplateColumns: "1fr", marginTop: 0 }}>
          <label><span className="lbl">Open the helpdesk on</span><select className="field" {...prefSel("start")}><option value="queue">Queue</option><option value="mine">My desk</option><option value="dispatch">Dispatch</option><option value="history">History</option><option value="customers">Customers</option><option value="reports">Reports</option><option value="audit">Audit log</option></select></label>
          <label><span className="lbl">Queue starts with</span><select className="field" {...prefSel("mine")}><option value="">All active tickets</option><option value="1">Tickets assigned to me</option></select></label>
          <label><span className="lbl">My team, preselected on new tickets</span><select className="field" id="acct-team" {...prefSel("team")}><option value="">No preference</option><Options list={S.cfg.teams} /></select></label>
          <label><span className="lbl">New notes start as</span><select className="field" {...prefSel("noteInternal")}><option value="1">Internal</option><option value="">Customer-visible</option></select></label>
        </div>
      </section>

      <section data-acct="notify" hidden={cur !== "notify"}>
        <p className="muted" style={{ marginBottom: 8 }}>Pop-ups appear in the helpdesk while it's open. The helpdesk can't send email or phone notifications.</p>
        {sw("notifyDecisions", "Tell me when a manager answers my requests")}
        {sw("notifyNew", "Tell me when a new request arrives (managers)", "nf-new", !mgr)}
        {sw("notifySound", "Play a chime for new requests (managers)", "nf-sound", !mgr)}
      </section>

      <section data-acct="security" hidden={cur !== "security"}><div id="acct-security">
        <div className="secnote"><b>Signing in</b>{S.meId ? "You're signed in through your organisation's sign-in" + (S.meName ? ", as " + S.meName : "") + ". The helpdesk has no passwords of its own, so sign out or switch accounts there." : "No sign-in is connected, so anyone using this browser has full access. Whoever hosts the helpdesk can connect one."}</div>
        <div className="secnote"><b>Multi-factor authentication</b>MFA is set up in your organisation's sign-in system, not in the helpdesk. If you sign in with Microsoft 365, your Microsoft 365 MFA rules apply here too. Your IT administrator can confirm how it's set up.</div>
        <div className="secnote"><b>Your Office 365 account</b>{me && me.m365 ? me.m365 + " is linked to your agent profile as a record for matching tickets and reports. It isn't used to sign in." : "Managers can link your Office 365 account to your agent profile as a record. It isn't used to sign in."}</div>
        <div className="secnote" style={{ marginBottom: 0 }}><b>Access</b>Your role is <b style={{ display: "inline", margin: 0 }}>{role}</b>. It comes from how this page is shared with you: Editors are managers, Contributors are agents and Viewers can only look.</div>
      </div></section>

      <section data-acct="reqs" hidden={cur !== "reqs"}><div id="acct-reqs">
        {mine.length ? mine.map((r: any) => <ReqRow key={r.id} r={r} />) : <p className="muted">You haven't sent any requests. When you try something only a manager can do, the helpdesk offers to send it to them.</p>}
      </div></section>

      <div className="actions" style={{ marginTop: 18 }}><button className="btn primary" data-act="acct-close" onClick={closeDialog}>Done</button></div>
    </Dialog>
  );
}
