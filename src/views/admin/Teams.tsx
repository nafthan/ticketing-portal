import { useEffect, useState } from "react";
import { S, toast } from "../../core/state.ts";
import { ACTIVE } from "../../core/constants.ts";
import { plural, slug } from "../../core/format.ts";
import { saveCfg } from "../../core/config.ts";
import { mTeams, onShift, staffName, staffSorted } from "../../core/people.ts";
import { setTeams, deleteTeam } from "../../core/staff.ts";
import { useApp, Icon, Person } from "../../ui/index.tsx";
import { focusId } from "./shared.tsx";

/** adTeamsTab(): one card per team, with its agents. */
export function Teams() {
  useApp();
  const teams = S.cfg.teams;
  const cnt = (v: string) => S.tickets.filter((t) => ACTIVE.has(t.status) && t.team === v).length;
  const [tmNew, setTmNew] = useState(false);
  const [tmRm, setTmRm] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});

  useEffect(() => { if (tmNew) focusId("tm-name"); }, [tmNew]);

  function create() {
    const v = name.trim();
    if (!v) { focusId("tm-name"); return; }
    if (S.cfg.teams.some((x) => x.toLowerCase() === v.toLowerCase())) { toast("There's already a team called that.", "worried"); return; }
    setTmNew(false); setName("");
    saveCfg({ teams: S.cfg.teams.concat([v]) } as any);
  }

  const card = (v: string) => {
    const mem = staffSorted().filter((m) => mTeams(m).includes(v)), others = staffSorted().filter((m) => !mTeams(m).includes(v));
    const selId = "tm-add-" + slug(v), sel = pick[v] || "";
    const addIn = () => {
      const m = S.staff.find((x) => x.id === sel);
      if (!m) { focusId(selId); return; }
      setPick({ ...pick, [v]: "" });
      setTeams(m, mTeams(m).concat([v]), "joined", v);
    };
    return (
      <div className="card teamcard" key={v}>
        <div className="th"><b>{v}</b>
          {tmRm === v
            ? <><button className="btn dark" data-act="tm-rm-yes" onClick={() => { setTmRm(null); deleteTeam(v); }}>Delete</button><button className="btn" data-act="tm-rm-no" onClick={() => setTmRm(null)}>Keep</button></>
            : <button className="x" data-act="tm-rm" data-v={v} aria-label={"Delete " + v} onClick={() => setTmRm(v)}><Icon name="x" /></button>}
        </div>
        <div className="sub">{plural(mem.length, "agent")}, {plural(cnt(v), "active ticket")}</div>
        {tmRm === v ? <p className="muted" style={{ fontSize: "12.5px", marginBottom: 8 }}>Deleting removes the team from its agents. Tickets keep the team name until they're edited.</p> : null}
        {mem.length ? mem.map((m) => {
          const on = onShift(m.uid, m.label);
          return (
            <div className="lrow" key={m.id}>
              <span className="nm"><Person uid={m.uid} label={m.label} size={26} /></span>
              <span className="ct">{on ? <span className="pill on">On shift</span> : m.avail === "leave" ? <span className="pill leave">On leave</span> : null}</span>
              <button className="x" data-act="tm-out" data-v={v} data-sid={m.id} aria-label={"Remove from " + v} onClick={() => setTeams(m, mTeams(m).filter((x) => x !== v), "left", v)}><Icon name="x" /></button>
            </div>
          );
        }) : <p className="muted" style={{ fontSize: 13 }}>No agents in this team yet.</p>}
        {others.length
          ? <div className="addrow">
              <select className="field" id={selId} aria-label={"Add an agent to " + v} value={sel} onChange={(e) => setPick({ ...pick, [v]: e.target.value })}>
                <option value="">Add an agent</option>
                {others.map((m) => <option key={m.id} value={m.id}>{staffName(m)}</option>)}
              </select>
              <button className="btn dark" data-act="tm-in" data-v={v} onClick={addIn}>Add</button>
            </div>
          : (S.staff.length ? null : <p className="muted" style={{ fontSize: "12.5px", marginTop: 8 }}>Add agents under Agents first.</p>)}
      </div>
    );
  };

  return (
    <>
      <div className="cardhead" style={{ marginBottom: 14 }}><h3 style={{ font: "600 18px/1.2 var(--display)" }}>Teams ({teams.length})</h3>
        {tmNew
          ? <div className="addrow" style={{ margin: 0, flex: "0 1 420px" }}>
              <input className="field" id="tm-name" maxLength={60} placeholder="Team name, e.g. Projects" aria-label="New team name" value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn" data-act="tm-new-cancel" onClick={() => { setTmNew(false); setName(""); }}>Cancel</button>
              <button className="btn primary" data-act="tm-create" onClick={create}>Create</button>
            </div>
          : <button className="btn primary" data-act="tm-new" onClick={() => setTmNew(true)}><Icon name="plus" />Create team</button>}
      </div>
      <p className="muted" style={{ marginBottom: 16 }}>Teams route tickets and filter Dispatch and Reports. An agent can belong to more than one team.</p>
      <div className="teamgrid">{teams.map(card)}</div>
    </>
  );
}
