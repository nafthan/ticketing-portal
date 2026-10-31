/* The announcement banner from Admin, General (renderAnnounce). Each browser can hide it until a new one is posted. */
import { useState } from "react";
import { S } from "../core/state.ts";
import { abs } from "../core/format.ts";
import { useApp, Icon, Who } from "../ui/index.tsx";

const TONE_LABEL: Record<string, string> = { info: "Notice", warning: "Warning", critical: "Critical" };

function dismissed(): string | null {
  try { return localStorage.getItem("helpdesk.annDismiss"); } catch (e) { return null; }
}

export function Announcement() {
  useApp();
  const [, force] = useState(0);
  const a = S.cfg ? S.cfg.announce : null;
  const show = !!a && (!a.until || new Date(a.until).getTime() > Date.now()) && dismissed() !== a.at;
  const dismiss = () => {
    try { localStorage.setItem("helpdesk.annDismiss", (a && a.at) || ""); } catch (e) { /* no storage */ }
    force((x) => x + 1);
  };
  return (
    <div id="announce">
      {show && a ? (
        <div className={"announce " + a.tone} role={a.tone === "critical" ? "alert" : "status"}>
          <span className="badge2">{TONE_LABEL[a.tone]}</span>
          <span className="tx">{a.text}<small>Posted by <Who uid={a.by} label={a.byLabel} fallback="a manager" />{a.at ? " at " + abs(a.at) : ""}</small></span>
          <button className="x" data-act="an-dismiss" aria-label="Hide this announcement" onClick={dismiss}><Icon name="x" /></button>
        </div>
      ) : null}
    </div>
  );
}
