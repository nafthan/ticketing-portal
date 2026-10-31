import { S, commit } from "../../core/state.ts";
import { allRequests } from "../../core/requests.ts";
import { useApp } from "../../ui/index.tsx";
import { General } from "./General.tsx";
import { Requests } from "./Requests.tsx";
import { Agents } from "./Agents.tsx";
import { Teams } from "./Teams.tsx";
import { Shifts } from "./Shifts.tsx";
import { Rules } from "./Rules.tsx";
import { Routing } from "./Routing.tsx";
import { Emails } from "./Emails.tsx";
import { Lists } from "./Lists.tsx";
import { Hours } from "./Hours.tsx";
import { Access } from "./Access.tsx";
import { System } from "./System.tsx";

const TABS: [string, string][] = [
  ["general", "General"], ["requests", "Requests"], ["agents", "Agents"], ["teams", "Teams"], ["shifts", "Shifts"], ["rules", "Rules"],
  ["routing", "Auto-assign"], ["emails", "Emails"], ["lists", "Categories"], ["hours", "Hours and SLA"], ["access", "Access and data"], ["system", "System"],
];
const BODY: Record<string, () => any> = {
  routing: Routing, emails: Emails, general: General, requests: Requests, agents: Agents, teams: Teams,
  shifts: Shifts, rules: Rules, lists: Lists, hours: Hours, access: Access, system: System,
};

/** renderAdmin(): the page head, the sub-tab buttons and the selected tab. */
export function Admin() {
  useApp();
  const pending = allRequests().filter((r: any) => r.status === "pending").length;
  const Body = BODY[S.adTab] || General;
  return (
    <>
      <div className="pagehead"><div><h1>Admin</h1><p>Settings for the whole helpdesk. Only managers can see this page.</p></div></div>
      <div className="seg" id="ad-tabs" role="group" aria-label="Admin sections">
        {TABS.map(([t, label]) => (
          <button key={t} data-act="ad-tab" data-t={t} id={t === "requests" ? "ad-req-tab" : undefined} aria-pressed={S.adTab === t}
            onClick={() => { S.adTab = t; commit(); }}>
            {t === "requests" ? "Requests" + (pending ? " (" + pending + ")" : "") : label}
          </button>
        ))}
      </div>
      <div id="ad-body" style={{ marginTop: 12 }}><Body key={S.adTab} /></div>
    </>
  );
}
