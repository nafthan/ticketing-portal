/* Clock out with active tickets (#co): keep them, or return them to Unassigned. Opened by clockOut(). */
import { S, closeDialog, toast } from "../core/state.ts";
import { plural } from "../core/format.ts";
import { myActive, setShift, assign } from "../core/tickets.ts";
import { useApp, Dialog, Icon } from "../ui/index.tsx";

export function ClockOutDialog() {
  useApp();
  const n = myActive().length;
  const keep = () => {
    closeDialog();
    setShift(S.meId, null, false).then((ok: any) => { if (ok) toast("Clocked out. Your tickets stay with you.", "sleepy"); });
  };
  const giveBack = () => {
    closeDialog();
    const mine = myActive();
    Promise.all(mine.map((t: any) => assign(t.id, null)))
      .then(() => setShift(S.meId, null, false))
      .then((ok: any) => { if (ok) toast("Clocked out. " + plural(mine.length, "ticket") + " returned to Unassigned.", "sleepy"); });
  };
  return (
    <Dialog id="co" className="dlg narrow" labelledBy="co-h" onClose={closeDialog}>
      <div className="d-top"><span className="lbl">Clock out</span><button className="x" data-act="co-cancel" aria-label="Close" onClick={closeDialog}><Icon name="x" /></button></div>
      <h2 id="co-h">Before you go</h2>
      <p className="muted" id="co-text">You have {plural(n, "active ticket")}. Keep them with you, or return them to Unassigned so someone on shift can pick them up.</p>
      <div className="actions" style={{ marginTop: 20, justifyContent: "flex-end" }}>
        <button className="btn" data-act="co-keep" onClick={keep}>Keep them</button>
        <button className="btn primary" data-act="co-return" onClick={giveBack}>Return to Unassigned</button>
      </div>
    </Dialog>
  );
}
