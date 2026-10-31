import { S } from "../core/state.ts";
import { NewTicketDialog } from "../dialogs/NewTicketDialog.tsx";
import { ResolveDialog } from "../dialogs/ResolveDialog.tsx";
import { RequestDialog } from "../dialogs/RequestDialog.tsx";
import { ShareDialog } from "../dialogs/ShareDialog.tsx";
import { ClockOutDialog } from "../dialogs/ClockOutDialog.tsx";
import { AccountDialog } from "../dialogs/AccountDialog.tsx";
import { PinDialog } from "../dialogs/PinDialog.tsx";
import { ImportDialog } from "../dialogs/ImportDialog.tsx";
import { RestoreDialog } from "../dialogs/RestoreDialog.tsx";
import { SetupDialog } from "../dialogs/SetupDialog.tsx";

/** Renders whichever dialog is open (S.dialog). Keyed so each opening starts fresh. */
export function Dialogs() {
  const d = S.dialog;
  if (!d) return null;
  const k = d.kind + ("id" in d ? ":" + d.id : "");
  switch (d.kind) {
    case "newTicket": return <NewTicketDialog key={k} customerId={d.customerId} />;
    case "resolve": return <ResolveDialog key={k} id={d.id} to={d.to} />;
    case "request": return <RequestDialog key={k} draft={d.draft} />;
    case "share": return <ShareDialog key={k} id={d.id} />;
    case "clockOut": return <ClockOutDialog key={k} />;
    case "account": return <AccountDialog key={k} tab={d.tab} />;
    case "pin": return <PinDialog key={k} id={d.id} />;
    case "import": return <ImportDialog key={k} plan={d.plan} />;
    case "restore": return <RestoreDialog key={k} data={d.data} />;
    case "setup": return <SetupDialog key={k} />;
  }
}
