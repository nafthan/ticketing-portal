/* Pinned messages on Queue and Dispatch. */
import { S, commit, toast, closeDialog } from "./state.ts";
import { putDoc, delDoc, logEvent, actor, writeFailed } from "./data.ts";
import { isMgr } from "./people.ts";
import type { Pin } from "./types.ts";

/** Pins shown on "queue" or "dispatch": live ones newest first, then (for managers) expired ones. */
export function pinsFor(where: string): (Pin & { expired: boolean })[] {
  const now = Date.now(), mgr = isMgr() && S.canWrite;
  return S.pins.filter((p) => (p.show || "both") === "both" || p.show === where)
    .map((p) => Object.assign({}, p, { expired: !!(p.until && new Date(p.until).getTime() <= now) }))
    .filter((p) => !p.expired || mgr)
    .sort((a, b) => ((a.expired as any) - (b.expired as any)) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
/**
 * Pin a new message (id null) or save an edit. `until` is a datetime-local value, "" for none.
 * Returns an error message, "" when the save failed (a toast says why), or null once saved (the dialog is closed).
 */
export async function savePin(id: string | null, f: { title?: string; text?: string; tone?: string; show?: string; until?: string | null }): Promise<string | null> {
  const title = String(f.title || "").trim().slice(0, 80), text = String(f.text || "").trim().slice(0, 1000), u = f.until || "";
  if (!text) return "Write the message you want to pin.";
  let until: string | null = null;
  if (u) { const d = new Date(u); if (isNaN(+d)) return "That date isn't valid."; if (d.getTime() <= Date.now()) return "Choose a time in the future, or leave it empty to keep it pinned."; until = d.toISOString(); }
  const now = new Date().toISOString(), old = id ? S.pins.find((x) => x.id === id) : null, pid = old ? old.id : "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const body: any = Object.assign({}, old || {}, {
    title, text, tone: ["note", "info", "warning", "critical"].includes(f.tone as string) ? f.tone : "note", show: ["both", "queue", "dispatch"].includes(f.show as string) ? f.show : "both", until, updatedAt: now,
  }, old ? {} : Object.assign({ createdAt: now }, actor())); delete body.id; delete body.expired;
  try {
    await putDoc("pins", pid, body); logEvent({ type: "pin", action: old ? "updated" : "created", ref: pid, detail: title || text.slice(0, 80) });
    closeDialog(); toast(old ? "Pinned message updated." : "Pinned for the team.", "happy"); return null;
  } catch (e) { writeFailed(e); return ""; }
}
export async function removePin(id: string): Promise<void> {
  const p = S.pins.find((x) => x.id === id); if (!p) { commit(); return; }
  try { await delDoc("pins", id); logEvent({ type: "pin", action: "removed", ref: id, detail: p.title || String(p.text || "").slice(0, 80) }); toast("Unpinned.", "happy"); } catch (e) { writeFailed(e); }
}
