import type { ReactNode } from "react";
import { S, svc } from "../../core/state.ts";
import { APP_VERSION } from "../../core/constants.ts";
import { plural } from "../../core/format.ts";
import { whoText } from "../../core/people.ts";
import { diagInfo, copyDiagnostics } from "../../core/diagnostics.ts";
import { useApp } from "../../ui/index.tsx";

/** adSystem(): connection, services, counts and background jobs. */
export function System() {
  useApp();
  const D: any = diagInfo(), db = !!svc.db;
  const yes = <span className="ok">✓</span>, no = <span className="no">–</span>, wn = <span className="wn">!</span>;
  const row = (mark: ReactNode, name: string, txt: string) => <div className="svc">{mark}<b>{name}</b><span className="muted">{txt}</span></div>;
  const modeTxt = ({ shared: "Connected to shared storage. Everyone sees the same tickets live.", local: "Running on its own. Data is saved in this browser only, because no backend is connected.", connecting: "Connecting…", error: "Lost the connection to shared storage. Reload the page to reconnect." } as Record<string, string>)[S.mode] || S.mode;
  const full = db && S.tickets.length >= 1000;
  const R = S.cfg.rules;
  return (
    <div className="adgrid">
      <div className="card adcard"><h3>Connection</h3><p className="muted">{modeTxt}</p>
        {row(D.services.db ? yes : wn, "Database", D.services.db ? "Tickets, customers and settings are shared." : "Not connected. Connect a backend to share one helpdesk across a team.")}
        {row(D.services.user ? yes : wn, "Sign-in", D.services.user ? (D.signedIn ? "Signed in as " + whoText(S.meId, null, "you") + ", " + D.role + "." : "Connected, but no one is signed in.") : "Not connected. Everyone has full access in this mode.")}
        {row(D.services.assets ? yes : no, "File storage", D.services.assets ? "Logos and profile photos can be uploaded." : "Not connected. Logo and photo uploads are hidden.")}
        {row(yes, "Downloads", D.services.downloads === "adapter" ? "Provided by your backend." : "Saved straight from the browser.")}
        {db ? row(D.extras.leases ? yes : no, "Locking", D.extras.leases ? "Supported, so two browsers never hand out the same ticket number." : "Not supported. Rarely, two browsers could act on the same ticket at once.") : null}
        {db ? row(D.extras.filters ? yes : wn, "Filtered queries", D.extras.filters ? "Supported, so older closed tickets can be loaded in History." : "Not supported. History can only show the newest 1,000 tickets.") : null}
        <div className="actions" style={{ justifyContent: "flex-start", marginTop: 14 }}><button className="btn" data-act="diag-copy" onClick={() => copyDiagnostics()}>Copy diagnostics</button></div>
        <p className="muted" style={{ fontSize: "12.5px", marginTop: 8 }}>Copies version, connection and browser details with no names, emails or ticket content, for bug reports.</p>
      </div>
      <div className="card adcard"><h3>This helpdesk</h3>
        <dl className="kv">
          <dt>Version</dt><dd>{APP_VERSION}</dd>
          <dt>Settings</dt><dd>{S.cfgExists ? "Saved" : "Using defaults, nothing saved yet"}</dd>
          <dt>Tickets loaded</dt><dd>{D.counts.tickets.toLocaleString()}{full ? <> <span className="pill">Newest 1,000</span></> : null}{D.counts.olderLoaded ? " plus " + D.counts.olderLoaded + " older" : ""}</dd>
          <dt>Customers</dt><dd>{D.counts.customers}</dd><dt>Agents</dt><dd>{D.counts.agents}</dd>
          <dt>Your role</dt><dd>{D.role[0].toUpperCase() + D.role.slice(1)}</dd>
          <dt>Browser time zone</dt><dd>{D.browser.timeZone}{D.browser.timeZone && D.browser.timeZone !== S.cfg.tz ? <> <span className="muted">(helpdesk uses {S.cfg.tz})</span></> : null}</dd>
        </dl>
        {full ? <p className="muted" style={{ fontSize: "12.5px", marginTop: 10 }}>Only the newest 1,000 tickets stay live in the browser. Reports count those; History can load older closed tickets.</p> : null}
      </div>
      <div className="card adcard" style={{ gridColumn: "1/-1" }}><h3>Background jobs</h3>
        <p className="muted">These run in the browser of whoever has the helpdesk open. If nobody does, they wait. When you host it yourself, move them to a scheduled job on your server; DEPLOYMENT.md explains how.</p>
        {row(R.autoCloseDays > 0 ? yes : no, "Auto-close", R.autoCloseDays > 0 ? "Resolved tickets close after " + plural(R.autoCloseDays, "day") + ". Needs a manager's browser." : "Off.")}
        {row(R.graceDays > 0 ? yes : no, "Closing grace period", R.graceDays > 0 ? "Tickets close for good " + plural(R.graceDays, "day") + " after being closed." : "Off.")}
        {row(S.cfg.requireShift && R.maxShiftHours > 0 ? yes : no, "Auto clock-out", S.cfg.requireShift && R.maxShiftHours > 0 ? "People are clocked out after " + plural(R.maxShiftHours, "hour") + "." : "Off.")}
        {row(D.jobs.autoAssignRetry ? yes : no, "Auto-assign retries", D.jobs.autoAssignRetry ? "Waiting tickets are assigned when someone on the list becomes free." : "Off.")}
      </div>
    </div>
  );
}
