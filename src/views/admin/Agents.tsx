import { useEffect, useRef, useState } from "react";
import { S, svc, toast, commit } from "../../core/state.ts";
import { AVAIL } from "../../core/constants.ts";
import { hm, plural } from "../../core/format.ts";
import { activeCount, mTeams, shiftOf, staffName, staffOf, staffSorted } from "../../core/people.ts";
import { setShift } from "../../core/tickets.ts";
import { addStaff, removeStaff, uploadStaffPhoto, removeStaffPhoto, saveAgent } from "../../core/staff.ts";
import type { Staff } from "../../core/types.ts";
import { useApp, Ava, Icon, Options, Who } from "../../ui/index.tsx";
import { focusId, useForm } from "./shared.tsx";

/** The edit form under an agent's row (part of adAgents) and saveAgent(m). */
function AgentEdit({ m, n, onClose, rm, setRm }: { m: Staff; n: number; onClose: () => void; rm: boolean; setRm: (v: boolean) => void }) {
  const teamList = S.cfg.teams.concat(mTeams(m).filter((t) => !S.cfg.teams.includes(t)));
  const [f, set] = useForm("agent" + JSON.stringify([m, S.cfg.teams]), () => ({
    "ag-title": m.title || "", "ag-m365": m.m365 || "", "ag-avail": m.avail || "available", "ag-oncall": !!m.oncall, teams: mTeams(m).slice(),
  }));
  const sel: string[] = f.teams;

  async function save() {
    const err = await saveAgent(m, { title: f["ag-title"], m365: f["ag-m365"], avail: f["ag-avail"], oncall: !!f["ag-oncall"], teams: teamList.filter((t) => sel.includes(t)) });
    if (err === null) onClose();
    else { const v = String(f["ag-m365"]).trim(); if (v && !/^\S+@\S+\.\S+$/.test(v)) focusId("ag-m365"); }
  }

  return (
    <div className="agedit">
      <label><span className="lbl">Job title</span><input className="field" id="ag-title" maxLength={60} placeholder="e.g. 2nd line engineer" autoComplete="off" value={f["ag-title"]} onChange={(e) => set("ag-title", e.target.value)} /></label>
      <label><span className="lbl">Office 365 account</span><input className="field" id="ag-m365" type="email" maxLength={120} placeholder="name@yourcompany.com" autoComplete="off" value={f["ag-m365"]} onChange={(e) => set("ag-m365", e.target.value)} /></label>
      <div><span className="lbl" style={{ display: "block", marginBottom: 6 }}>Profile photo</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Ava uid={m.uid} label={m.label} size={40} />
          {svc.assets
            ? <>
                <label className="btn" style={{ cursor: "pointer" }}><Icon name="up" />{m.photoId ? "Replace" : "Upload"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" data-act-file="agphoto" data-sid={m.id} hidden
                    onChange={(e) => { const file = e.target.files && e.target.files[0]; e.target.value = ""; uploadStaffPhoto(m, file); }} />
                </label>
                {m.photoId ? <button className="btn" data-act="ag-photo-rm" data-sid={m.id} onClick={() => removeStaffPhoto(m)}>Remove</button> : null}
              </>
            : <span className="muted" style={{ fontSize: "12.5px" }}>Uploads aren't available in this view.</span>}
        </div>
      </div>
      <label><span className="lbl">Availability</span><select className="field" id="ag-avail" value={f["ag-avail"]} onChange={(e) => set("ag-avail", e.target.value)}><Options list={Object.keys(AVAIL)} label={(k) => (AVAIL as any)[k]} /></select></label>
      <div className="full"><span className="lbl" style={{ display: "block", marginBottom: 8 }}>Teams</span>
        <div className="teamchecks">
          {teamList.map((t) => (
            <label className="check" key={t}><input type="checkbox" className="ag-team" value={t} checked={sel.includes(t)}
              onChange={(e) => set("teams", e.target.checked ? sel.concat([t]) : sel.filter((x) => x !== t))} />{t}</label>
          ))}
        </div>
      </div>
      <label className="check full"><input type="checkbox" id="ag-oncall" checked={!!f["ag-oncall"]} onChange={(e) => set("ag-oncall", e.target.checked)} />On call</label>
      <div className="full actions" style={{ justifyContent: "space-between" }}>
        {rm
          ? <span className="actions">
              <button className="btn dark" data-act="staff-rm-yes" data-sid={m.id} onClick={() => { setRm(false); removeStaff(m); }}>Remove {staffName(m)}</button>
              <button className="btn" data-act="staff-rm-no" onClick={() => setRm(false)}>Keep</button>
            </span>
          : <button className="btn" data-act="staff-rm" data-sid={m.id} onClick={() => setRm(true)}>Remove agent</button>}
        <span className="actions">
          <button className="btn" data-act="ag-edit" data-sid={m.id} onClick={onClose}>Cancel</button>
          <button className="btn primary" data-act="ag-save" data-sid={m.id} onClick={save}>Save</button>
        </span>
      </div>
      {n ? <p className="muted full" style={{ fontSize: "12.5px" }}>Removing an agent keeps their {plural(n, "active ticket")} assigned to them. Reassign them on Dispatch first if needed.</p> : null}
    </div>
  );
}

/** The "Add agent" panel: search your organisation, or add a name only. */
function AgentAdd() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const qRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => { focusId(svc.user ? "staff-q" : "staff-label"); }, []);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { const t = e.target as Element; if (!(t && t.closest && t.closest(".picker"))) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);

  async function staffSearch(v: string) {
    setQ(v);
    if (!svc.user) return;
    const my = ++seq.current;
    const found = ((await svc.user.search(v)) || []).filter((h: any) => !staffOf(h.id));
    if (my !== seq.current) return;
    if (qRef.current !== document.activeElement && v) return;
    for (const h of found) S.names[h.id] = h.name;
    setHits(found); setOpen(found.length > 0);
  }
  function addLabel() {
    const v = label.trim();
    if (!v) return;
    if (S.staff.some((m) => !m.uid && String(m.label).toLowerCase() === v.toLowerCase())) { toast("There's already an agent with that name.", "worried"); return; }
    addStaff(null, v); setLabel("");
  }

  return (
    <div className="agedit" style={{ margin: "4px 0 14px" }}>
      {svc.user
        ? <div className="full"><span className="lbl" style={{ display: "block", marginBottom: 6 }}>Someone in your organisation</span>
            <div className="picker">
              <input className="field" id="staff-q" ref={qRef} style={{ width: "100%" }} placeholder="Search by name" autoComplete="off" value={q}
                onChange={(e) => staffSearch(e.target.value)} onFocus={(e) => staffSearch(e.target.value)} />
              <div className="pop" id="staff-pop" hidden={!open}>
                {hits.map((h) => <button key={h.id} className="opt" data-act="staff-add" data-uid={h.id} onClick={() => { setQ(""); setOpen(false); addStaff(h.id, null); }}>{h.name}</button>)}
              </div>
            </div>
            <p className="muted" style={{ fontSize: "12.5px", marginTop: 6 }}>Their name and photo come from your sign-in system, and they can clock in and take tickets themselves.</p>
          </div>
        : null}
      <div className="full"><span className="lbl" style={{ display: "block", marginBottom: 6 }}>{svc.user ? "Or add a name only" : "Name"}</span>
        <div className="addrow" style={{ margin: 0 }}>
          <input className="field" id="staff-label" placeholder="e.g. Sam Patel" maxLength={60} aria-label="Agent name" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn dark" data-act="staff-add-label" onClick={addLabel}>Add</button>
        </div>
        <p className="muted" style={{ fontSize: "12.5px", marginTop: 6 }}>For someone without access yet. Managers clock them in and assign their tickets.</p>
      </div>
      <div className="full note" style={{ margin: 0 }}><span>Adding someone here doesn't give them access. Share this page with them as a <b>Contributor</b> to make them an agent, or as an <b>Editor</b> to make them a manager.</span></div>
      {S.meId && !staffOf(S.meId) ? <div className="full"><button className="btn" data-act="staff-me" onClick={() => addStaff(S.meId, null)}>Add me</button></div> : null}
    </div>
  );
}

/** adAgents(): the list of agents, with search, add and edit. */
export function Agents() {
  useApp();
  const [qRaw, setQRaw] = useState("");
  const [agAdd, setAgAdd] = useState(false);
  const [agEdit, setAgEdit] = useState<string | null>(null);
  const [rmStaff, setRmStaff] = useState<string | null>(null);
  const q = qRaw.trim().toLowerCase();
  const list = staffSorted().filter((m) => !q || (staffName(m) + " " + (m.title || "") + " " + mTeams(m).join(" ")).toLowerCase().includes(q));

  const row = (m: Staff) => {
    const sh = shiftOf(m.uid, m.label), on = !!(sh && sh.on), n = activeCount(m), ed = agEdit === m.id;
    const toggle = () => { setAgEdit(agEdit === m.id ? null : m.id); setRmStaff(null); };
    return (
      <div className="agrow" key={m.id}>
        <div className="who"><Ava uid={m.uid} label={m.label} size={34} />
          <span style={{ minWidth: 0 }}><b><Who uid={m.uid} label={m.label} /></b><small>{(m.title || "Agent") + (m.uid ? "" : ", no sign-in")}</small>{m.m365 ? <small>{m.m365}</small> : null}</span>
        </div>
        <div className="chips">{mTeams(m).length ? mTeams(m).map((t) => <span className="pill" key={t}>{t}</span>) : <span className="muted" style={{ fontSize: "12.5px" }}>No team</span>}</div>
        <span>{m.avail && m.avail !== "available" ? <span className={"pill" + (m.avail === "leave" ? " leave" : "")}>{(AVAIL as any)[m.avail]}</span> : <span className="pill">Available</span>}{m.oncall ? <> <span className="pill oncall">On call</span></> : null}</span>
        <span>{on ? <span className="pill on">On since {hm(sh!.since as string)}</span> : <span className="pill">Off shift</span>}</span>
        <span className="num muted" title="Active tickets">{plural(n, "ticket")}</span>
        <span className="acts">
          <button className="btn" data-act="ad-shift" data-suid={m.uid || ""} data-label={m.label || ""} data-on={on ? 0 : 1} onClick={() => setShift(m.uid || null, m.label || null, !on)}>{on ? "Clock out" : "Clock in"}</button>
          <button className={"btn" + (ed ? " dark" : "")} data-act="ag-edit" data-sid={m.id} aria-expanded={ed} onClick={toggle}>{ed ? "Close" : "Edit"}</button>
        </span>
        {ed ? <AgentEdit m={m} n={n} onClose={() => { setAgEdit(null); setRmStaff(null); commit(); }} rm={rmStaff === m.id} setRm={(v) => setRmStaff(v ? m.id : null)} /> : null}
      </div>
    );
  };

  return (
    <div className="card adcard">
      <div className="cardhead"><h3>Agents ({S.staff.length})</h3>
        <div className="searchbox" style={{ flex: "0 1 240px" }}><Icon name="search" /><input className="field" id="ag-q" type="search" placeholder="Find an agent" aria-label="Find an agent" value={qRaw} onChange={(e) => setQRaw(e.target.value)} /></div>
        <button className={"btn " + (agAdd ? "" : "primary")} data-act="ag-add" onClick={() => setAgAdd(!agAdd)}>{agAdd ? "Done adding" : <><Icon name="plus" />Add agent</>}</button>
      </div>
      <p className="muted">The people who work tickets. Set their job title, teams and availability, or clock them in and out.</p>
      {agAdd ? <AgentAdd /> : null}
      {list.length ? list.map(row) : <p className="muted">{q ? "No agents match." : "No agents yet. Add your first one."}</p>}
    </div>
  );
}
