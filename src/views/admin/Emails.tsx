import { useState } from "react";
import { S } from "../../core/state.ts";
import { EM_EVENTS } from "../../core/constants.ts";
import { emailsSave } from "../../core/config.ts";
import { useApp } from "../../ui/index.tsx";
import { useForm, focusId } from "./shared.tsx";

/** adEmails() and emailsSave(). */
export function Emails() {
  useApp();
  const e = S.cfg.email, keys = Object.keys(EM_EVENTS);
  const [f, set] = useForm("emails" + S.cfgVer, () => {
    const o: Record<string, any> = { "em-app": e.app };
    for (const k of keys) { const tp = e.templates[k]; o["em-on-" + k] = !!tp.on; o["em-sub-" + k] = tp.subject; o["em-body-" + k] = tp.body; }
    return o;
  });
  const [err, setErr] = useState("");

  async function save() {
    const templates: Record<string, { on: boolean; subject: string; body: string }> = {};
    for (const k of keys) templates[k] = { on: !!f["em-on-" + k], subject: f["em-sub-" + k], body: f["em-body-" + k] };
    const err = await emailsSave({ app: f["em-app"], templates });
    if (err) {
      setErr(err);
      const k = keys.find((x) => !String(f["em-sub-" + x]).trim() || !String(f["em-body-" + x]).trim());
      if (k) focusId(String(f["em-sub-" + k]).trim() ? "em-body-" + k : "em-sub-" + k);
    }
  }

  return (
    <>
      <div className="note"><span>The helpdesk can't send email by itself, because it has no mail service it's allowed to reach. Instead, when one of these events happens, it writes the email and puts it on the ticket and on the assignee's My desk, ready to open in Outlook and send in one click.</span></div>
      <div className="card adcard" style={{ maxWidth: 820 }}>
        <div className="cardhead"><h3>Customer emails</h3>
          <label className="check" style={{ fontSize: 13 }}>Open emails in <select className="field" id="em-app" style={{ height: 32, marginLeft: 6 }} value={f["em-app"]} onChange={(ev) => set("em-app", ev.target.value)}><option value="outlook">Outlook on the web</option><option value="mailto">My default email app</option></select></label>
        </div>
        <p className="muted">You can use these placeholders: {"{contact}, {ticket}, {subject}, {customer}, {site}, {severity}, {status}, {agent}, {resolution}, {closingDate}, {helpdesk}, {link}"}.</p>
        {keys.map((k) => (
          <div className="tpl" key={k}>
            <label className="switch"><span><b style={{ fontWeight: 500 }}>{(EM_EVENTS as any)[k]}</b></span><input type="checkbox" id={"em-on-" + k} checked={!!f["em-on-" + k]} onChange={(ev) => set("em-on-" + k, ev.target.checked)} /></label>
            <div className="form">
              <label><span className="lbl">Subject</span><input className="field" id={"em-sub-" + k} maxLength={200} value={f["em-sub-" + k]} onChange={(ev) => set("em-sub-" + k, ev.target.value)} /></label>
              <label><span className="lbl">Message</span><textarea className="field" id={"em-body-" + k} rows={6} maxLength={4000} value={f["em-body-" + k]} onChange={(ev) => set("em-body-" + k, ev.target.value)} /></label>
            </div>
          </div>
        ))}
        <div className="err" id="em-err">{err}</div>
        <div className="actions" style={{ marginTop: 8 }}><button className="btn primary" data-act="em-save" onClick={save}>Save email templates</button></div>
      </div>
    </>
  );
}
