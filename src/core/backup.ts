/* Full backup and restore. */
import { S, ref, commit, toast, openDialog, closeDialog } from "./state.ts";
import { APP_VERSION, BK_COLS, LS_COL } from "./constants.ts";
import { save, logEvent, withRetry, saveCol, applyCol, index, saveLocal, writeFailed } from "./data.ts";
import { setCfg } from "./config.ts";
import { whoText, isMgr } from "./people.ts";

/** Every document in a collection, paging by `field`. Null without a backend. */
export async function fetchAll(name: string, field: string): Promise<Record<string, any> | null> {
  if (!ref.db) return null; const out = new Map<string, any>(); let before: any = null;
  for (let i = 0; i < 200; i++) {
    let q = ref.db.collection(name); if (before && typeof q.where === "function") q = q.where(field, "<", before);
    const sn = await q.orderBy(field, "desc").limit(1000).get();
    for (const d of sn.docs) out.set(d.id, d.data());
    if (sn.docs.length < 1000 || typeof ref.db.collection(name).where !== "function") break;
    const last = sn.docs[sn.docs.length - 1].data()[field]; if (!last || last === before) break; before = last;
  }
  return Object.fromEntries(out);
}
/** A list of records as {id: record-without-id}. */
export const objOf = (list: any[]): Record<string, any> => Object.fromEntries(list.map((x) => { const o = Object.assign({}, x); delete o.id; return [x.id, o]; }));
/** Download everything as one JSON file. */
export async function makeBackup(): Promise<void> {
  if (!isMgr()) { toast("Only managers can make a backup.", "worried"); return; }
  toast("Gathering everything for the backup…", "happy");
  try {
    let tickets: any, events: any;
    if (ref.db) { tickets = await fetchAll("tickets", "createdAt"); events = await fetchAll("events", "at"); }
    else { tickets = objOf([...S.byId.values()]); events = objOf(S.events); }
    for (const t of S.byId.values()) if (!tickets[t.id]) { const o: any = Object.assign({}, t); delete o.id; tickets[t.id] = o; }
    const data = {
      format: "helpdesk-backup", formatVersion: 1, app: APP_VERSION, exportedAt: new Date().toISOString(), exportedBy: whoText(S.meId, null, "Unknown"),
      collections: {
        config: S.cfgExists ? { settings: S.cfg } : {}, tickets, pins: objOf(S.pins), customers: objOf(S.customers), staff: objOf(S.staff), queues: objOf(S.queues), shifts: objOf(S.shifts), events,
        counters: Object.fromEntries(Object.entries(S.counters || {}).map(([k, v]) => { const o: any = Object.assign({}, v); delete o.id; return [k, o]; })),
        requests: objOf(S.reqDocs || []), decisions: Object.assign({}, S.decisions || {}),
      },
    };
    const n = Object.keys(tickets).length;
    await save("helpdesk-backup-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(data, null, 1));
    logEvent({ type: "settings", detail: "Full backup downloaded (" + n + " tickets)" });
  } catch (e) { toast("The backup couldn't be made. Try again in a moment.", "worried"); }
}
/** Read a backup file and open the restore dialog ({kind:"restore", data}). */
export function readRestore(file: File): void {
  if (!isMgr()) { toast("Only managers can restore a backup.", "worried"); return; }
  file.text().then((text) => {
    let d: any; try { d = JSON.parse(text); } catch (e) { toast("That isn't a helpdesk backup file.", "worried"); return; }
    if (!d || d.format !== "helpdesk-backup" || !d.collections || typeof d.collections !== "object") { toast("That isn't a helpdesk backup file.", "worried"); return; }
    openDialog({ kind: "restore", data: d });
  }).catch(() => toast("That file couldn't be read.", "worried"));
}
/** Restore a backup: records replace ones with the same id. onProgress(done, total) every 20 records and at the end. Closes the dialog and resolves true when done. */
export async function runRestore(data: any, onProgress?: (done: number, total: number) => void): Promise<boolean> {
  const d = data; if (!d) return false;
  const C = d.collections, jobs: [string, string, any][] = [];
  for (const k of BK_COLS) {
    const o = C[k]; if (!o || typeof o !== "object") continue; if (!ref.db && (k === "requests" || k === "decisions")) continue;
    for (const [id, body] of Object.entries(o)) if (body && typeof body === "object" && /^[A-Za-z0-9_.~:@+-]{1,200}$/.test(id)) jobs.push([k, id, body]);
  }
  try {
    let n = 0; const localT: any[] = [];
    for (const [k, id, body] of jobs) {
      if (ref.db) { const r = k === "config" ? ref.db.doc("config/" + id) : ref.db.collection(k).doc(id); await withRetry(() => r.set(body)); }
      else if (k === "tickets") localT.push(Object.assign({}, body, { id }));
      else if (k === "config") { if (id === "settings") { saveCol("config", body); S.cfgExists = true; setCfg(body); } }
      else if (k === "counters") S.counters[id] = body;
      else if (LS_COL[k]) applyCol(k, id, body, false);
      if (++n % 20 === 0 || n === jobs.length) { if (onProgress) onProgress(n, jobs.length); }
    }
    if (!ref.db && localT.length) { const ids = new Set(localT.map((t) => t.id)); index(localT.concat(S.tickets.filter((t) => !ids.has(t.id)))); saveLocal(); }
    logEvent({ type: "settings", detail: "Restored from a backup made " + (d.exportedAt || "") + " (" + jobs.length + " records)" });
    closeDialog(); commit(); toast("Restored " + jobs.length + " records.", "party"); return true;
  } catch (e) { writeFailed(e); return false; }
}
