/* System diagnostics: version, connection and browser details with no personal data. */
import { S, svc, ref, toast } from "./state.ts";
import { APP_VERSION } from "./constants.ts";
import { isMgr } from "./people.ts";

export function diagInfo() {
  const c = ref.db ? ref.db.collection("tickets") : null, docRef = c ? c.doc("x") : null, nav: any = typeof navigator !== "undefined" ? navigator : {};
  return {
    version: APP_VERSION, mode: S.mode, services: { db: !!ref.db, user: !!svc.user, assets: !!svc.assets, downloads: svc.downloads ? (svc.downloads.browser ? "browser" : "adapter") : "none" },
    extras: { leases: !!(docRef && typeof docRef.acquire === "function"), filters: !!(c && typeof c.where === "function") },
    signedIn: !!S.meId, role: !S.canWrite ? "viewer" : isMgr() ? "manager" : "agent", settingsSaved: !!S.cfgExists,
    counts: { tickets: S.tickets.length, olderLoaded: S.arch.size, customers: S.customers.length, agents: S.staff.length, auditEntries: S.events.length },
    jobs: { autoCloseDays: S.cfg.rules.autoCloseDays, graceDays: S.cfg.rules.graceDays, maxShiftHours: S.cfg.rules.maxShiftHours, autoAssignRetry: !!(S.cfg.routing && S.cfg.routing.on && S.cfg.routing.retry) },
    browser: { userAgent: nav.userAgent, timeZone: (Intl.DateTimeFormat().resolvedOptions().timeZone || ""), online: nav.onLine !== false },
  };
}
export function copyDiagnostics(): void {
  const txt = "helpdesk diagnostics\n" + JSON.stringify(diagInfo(), null, 2);
  const done = () => toast("Diagnostics copied. Paste them into your issue or message.", "happy");
  const fallback = () => {
    const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { toast("Couldn't copy. Your browser blocked it.", "worried"); } ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(fallback); else fallback();
}
