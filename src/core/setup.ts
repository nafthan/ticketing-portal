/* First-run setup, offered to a manager on an empty helpdesk with no saved settings. */
import { S, ref, commit, toast, openDialog, closeDialog } from "./state.ts";
import { plural } from "./format.ts";
import { withRetry, saveCol, logEvent, writeFailed } from "./data.ts";
import { normCfg, setCfg } from "./config.ts";
import { isMgr } from "./people.ts";

let setupShown = false;
export function setupSkipped(): boolean { try { return localStorage.getItem("helpdesk.setupSkipped") === "1"; } catch (e) { return false; } }
/** Open {kind:"setup"} once, when it applies. Cheap: call it as often as you like. */
export function maybeSetup(): void {
  if (setupShown || !S.cfgKnown || S.cfgExists || !S.loaded || S.tickets.length || !S.canWrite || !isMgr() || setupSkipped()) return;
  if (ref.db && !S.meId) return;
  if (S.dialog) return;
  setupShown = true;
  openDialog({ kind: "setup" });
}
export function setupSkip(): void { try { localStorage.setItem("helpdesk.setupSkipped", "1"); } catch (e) { /* storage blocked */ } closeDialog(); }
/**
 * Save the setup form. teams and cats are one per line (text) or arrays; prefix is uppercased here; days are 0 (Sun) to 6.
 * Returns an error message, "" when the save failed (a toast says why), or null once saved (the dialog is closed).
 */
export async function setupSave(v: { name: string; prefix: string; teams: string | string[]; cats: string | string[]; tz: string; start: string; end: string; days: number[] }): Promise<string | null> {
  const name = String(v.name || "").trim(), prefix = String(v.prefix || "").trim().toUpperCase();
  const lines = (x: string | string[]) => [...new Set((Array.isArray(x) ? x : String(x || "").split(/\n/)).map((s) => String(s).trim()).filter(Boolean))];
  const teams = lines(v.teams), cats = lines(v.cats), start = v.start, end = v.end, days = v.days || [];
  if (!name) return "Give the helpdesk a name.";
  if (!/^[A-Z0-9]{1,6}$/.test(prefix)) return "The prefix needs 1 to 6 letters or numbers.";
  if (!teams.length) return "Add at least one team.";
  if (!cats.length) return "Add at least one category.";
  if (!days.length) return "Choose at least one working day.";
  if (!start || !end || start >= end) return "The working day has to end after it starts.";
  const b = normCfg(Object.assign({}, S.cfg, { name, idPrefix: prefix, teams, categories: cats, tz: v.tz, days, start, end, defaults: Object.assign({}, S.cfg.defaults, { team: teams.includes(S.cfg.defaults.team) ? S.cfg.defaults.team : "" }) }));
  try {
    if (ref.db) await withRetry(() => ref.db.doc("config/settings").set(b)); else saveCol("config", b);
    S.cfgExists = true; setCfg(b); logEvent({ type: "settings", detail: "First-run setup: " + b.name + ", prefix " + b.idPrefix + ", " + plural(b.teams.length, "team") + ", " + plural(b.categories.length, "category") });
    closeDialog(); commit(); toast("All set. Create your first ticket whenever you're ready.", "party"); return null;
  } catch (e) { writeFailed(e); return ""; }
}
