import { S, TICKET_VIEWS } from "./core/state.ts";
import { isMgr } from "./core/people.ts";
import { useApp } from "./ui/index.tsx";
import { Header } from "./shell/Header.tsx";
import { Footer } from "./shell/Footer.tsx";
import { Toast } from "./shell/Toast.tsx";
import { Announcement } from "./shell/Announcement.tsx";
import { Dialogs } from "./shell/Dialogs.tsx";
import { Queue } from "./views/Queue.tsx";
import { MyDesk } from "./views/MyDesk.tsx";
import { Dispatch } from "./views/Dispatch.tsx";
import { History } from "./views/History.tsx";
import { Customers } from "./views/Customers.tsx";
import { Reports } from "./views/Reports.tsx";
import { Audit } from "./views/Audit.tsx";
import { Admin } from "./views/admin/Admin.tsx";
import { TicketPanel } from "./panels/TicketPanel.tsx";
import { CustomerPanel } from "./panels/CustomerPanel.tsx";

const VIEW = { queue: Queue, mine: MyDesk, dispatch: Dispatch, history: History, customers: Customers, reports: Reports, audit: Audit, admin: Admin };

export function App() {
  useApp();
  const view = S.view === "admin" && !isMgr() ? "queue" : S.view;
  const View = VIEW[view];
  const ticketOpen = TICKET_VIEWS.includes(view) && !!(S.sel && S.byId.get(S.sel));
  const custOpen = view === "customers" && !!(S.selCust && S.custById.get(S.selCust));
  return (
    <>
      <Header />
      <main className={(ticketOpen || custOpen ? "has-detail" : "") + (view === "dispatch" ? " wide" : "")}>
        <Announcement />
        <section id={"v-" + view}><View /></section>
        {ticketOpen ? <aside className="detail" id="detail" aria-label="Ticket"><TicketPanel id={S.sel!} /></aside> : null}
        {custOpen ? <aside className="detail" id="detail" aria-label="Customer"><CustomerPanel id={S.selCust!} /></aside> : null}
      </main>
      <Footer />
      <Toast />
      <Dialogs />
    </>
  );
}
