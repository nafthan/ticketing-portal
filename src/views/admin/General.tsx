import { useState } from "react";
import { S } from "../../core/state.ts";
import { SEV, CHANNELS } from "../../core/constants.ts";
import { abs, toLocalInput } from "../../core/format.ts";
import { generalSave, announcePost, announceClear } from "../../core/config.ts";
import { useApp, Options } from "../../ui/index.tsx";
import { useForm, focusId } from "./shared.tsx";

/** adGeneral(), generalSave() and the announcement form. */
export function General() {
  useApp();
  const c = S.cfg, a = c.announce;
  const [f, set] = useForm("general" + S.cfgVer, () => ({
    "g-name": c.name, "g-share": c.shareUrl || "", "g-prefix": c.idPrefix,
    "g-sev": c.defaults.severity, "g-chan": c.defaults.channel, "g-team": c.defaults.team,
    "an-t": a ? a.text : "", "an-tone": a ? a.tone : "info", "an-until": a && a.until ? toLocalInput(a.until) : "",
  }));
  const [prefixTyped, setPrefixTyped] = useState(false);
  const [gErr, setGErr] = useState("");
  const [anErr, setAnErr] = useState("");
  const preview = prefixTyped ? (String(f["g-prefix"]).trim() || "?").toUpperCase() + "-7K2QM" : c.idPrefix + "-7K2QM";
  const teamList = c.teams.includes(c.defaults.team) || !c.defaults.team ? c.teams : c.teams.concat([c.defaults.team]);

  async function save() {
    setGErr("");
    const err = await generalSave({ name: f["g-name"], shareUrl: f["g-share"], prefix: f["g-prefix"], severity: f["g-sev"], channel: f["g-chan"], team: f["g-team"] });
    if (err) { setGErr(err); focusId(/name/.test(err) ? "g-name" : /prefix/.test(err) ? "g-prefix" : "g-share"); }
  }

  async function post() {
    setAnErr("");
    const err = await announcePost(f["an-t"], f["an-tone"], f["an-until"]);
    if (err) { setAnErr(err); focusId(/message/.test(err) ? "an-t" : "an-until"); }
  }

  return (
    <div className="adgrid">
      <div className="card adcard"><h3>Helpdesk</h3><p className="muted">How the helpdesk introduces itself, and what new tickets start with.</p>
        <div className="form" style={{ marginTop: 0 }}>
          <label className="full"><span className="lbl">Helpdesk name</span><input className="field" id="g-name" maxLength={40} autoComplete="off" value={f["g-name"]} onChange={(e) => set("g-name", e.target.value)} /></label>
          <label className="full"><span className="lbl">Link used when sharing tickets</span><input className="field" id="g-share" type="url" maxLength={500} placeholder="https://helpdesk.example.com" autoComplete="off" value={f["g-share"]} onChange={(e) => set("g-share", e.target.value)} />
            <span className="muted" style={{ fontSize: "12.5px" }}>The address people open the helpdesk at. It's added to tickets shared to Teams.</span></label>
          <label><span className="lbl">Default ticket ID prefix</span><input className="field" id="g-prefix" maxLength={6} autoComplete="off" value={f["g-prefix"]} onChange={(e) => { setPrefixTyped(true); set("g-prefix", e.target.value); }} /></label>
          <div><span className="lbl" style={{ display: "block", marginBottom: 6 }}>New tickets look like</span><span className="tid" id="g-preview" style={{ lineHeight: "36px" }}>{preview}</span></div>
          <label><span className="lbl">Default severity</span><select className="field" id="g-sev" value={f["g-sev"]} onChange={(e) => set("g-sev", e.target.value)}><Options list={Object.keys(SEV)} label={(o) => o + " " + (SEV as any)[o].label} /></select></label>
          <label><span className="lbl">Default channel</span><select className="field" id="g-chan" value={f["g-chan"]} onChange={(e) => set("g-chan", e.target.value)}><Options list={Object.keys(CHANNELS)} label={(k) => (CHANNELS as any)[k]} /></select></label>
          <label className="full"><span className="lbl">Default team</span><select className="field" id="g-team" value={f["g-team"]} onChange={(e) => set("g-team", e.target.value)}><option value="">First team in the list</option><Options list={teamList} /></select></label>
          <p className="muted full" style={{ fontSize: "12.5px" }}>If an agent has set their own team in Account settings, that wins over the default team. The default prefix is for customers without their own; set one for a specific customer on the customer record. Existing tickets keep their IDs when a prefix changes.</p>
          <div className="full err" id="g-err">{gErr}</div><div className="full actions"><button className="btn primary" data-act="g-save" onClick={save}>Save</button></div>
        </div>
      </div>
      <div className="card adcard"><h3>Announcement</h3><p className="muted">A message at the top of every page, for everyone. Use it for outages, maintenance or anything the whole team should see.</p>
        {a ? <div className={"announce " + a.tone} style={{ marginBottom: 14 }}><span className="tx">{a.text}{a.until ? <small>Showing until {abs(a.until)}</small> : null}</span></div> : null}
        <div className="form" style={{ marginTop: 0 }}>
          <label className="full"><span className="lbl">Message</span><textarea className="field" id="an-t" rows={3} maxLength={500} placeholder="e.g. Microsoft 365 outage affecting Outlook. Updates every 30 minutes." value={f["an-t"]} onChange={(e) => set("an-t", e.target.value)} /></label>
          <label><span className="lbl">Style</span><select className="field" id="an-tone" value={f["an-tone"]} onChange={(e) => set("an-tone", e.target.value)}><option value="info">Information</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label>
          <label><span className="lbl">Show until (optional)</span><input className="field" type="datetime-local" id="an-until" value={f["an-until"]} onChange={(e) => set("an-until", e.target.value)} /></label>
          <div className="full err" id="an-err">{anErr}</div>
          <div className="full actions">
            {a ? <button className="btn" data-act="an-clear" onClick={() => announceClear()}>Take it down</button> : null}
            <button className="btn primary" data-act="an-post" onClick={post}>{a ? "Update announcement" : "Post announcement"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
