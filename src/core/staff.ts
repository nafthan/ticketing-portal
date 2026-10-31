/* The agent list (staff) and teams. */
import { S, P, svc, toast } from "./state.ts";
import { AVAIL } from "./constants.ts";
import { slug } from "./format.ts";
import { putDoc, delDoc, logEvent } from "./data.ts";
import { staffOf, mTeams } from "./people.ts";
import { saveCfg } from "./config.ts";
import type { Staff } from "./types.ts";

/** The staff document id: "u-<uid>" or "l-<slug of label>". */
export function staffId(uid: string | null | undefined, label?: string | null): string { return uid ? "u-" + String(uid).replace(/[^A-Za-z0-9_.~:@+-]/g, "_") : "l-" + slug(label); }
export function staffFail(e: any): void { toast(e && e.code === "invalid_argument" ? "Only managers can change the team list." : "That didn't save. Check your connection and try again.", "worried"); }
/** Add someone with a sign-in (uid) or a name only (label). */
export async function addStaff(uid: string | null | undefined, label?: string | null): Promise<void> {
  if (!uid && !label || staffOf(uid, label)) return;
  try {
    await putDoc("staff", staffId(uid, label), { uid: uid || null, label: uid ? null : label, teams: uid && uid === S.meId && P.team ? [P.team] : [], title: "", avail: "available", oncall: false, addedAt: new Date().toISOString() });
    logEvent({ type: "staff", action: "added", target: uid || null, targetLabel: uid ? null : label });
  } catch (e) { staffFail(e); }
}
export async function updateStaff(m: Staff, field: string, val: any): Promise<void> {
  if (m[field] === val) return;
  try { await putDoc("staff", m.id, { [field]: val }, true); logEvent({ type: "staff", action: field, target: m.uid || null, targetLabel: m.uid ? null : m.label, from: m[field] == null ? null : m[field], to: val }); } catch (e) { staffFail(e); }
}
export async function removeStaff(m: Staff): Promise<void> { try { await delDoc("staff", m.id); logEvent({ type: "staff", action: "removed", target: m.uid || null, targetLabel: m.uid ? null : m.label }); } catch (e) { staffFail(e); } }
/** Crop and shrink an image file to a 256px JPEG data URL. */
export function resizePhoto(file: File | null | undefined): Promise<string> {
  return new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) return rej(new Error("type"));
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const n = 256, c = document.createElement("canvas"); c.width = c.height = n; const x = c.getContext("2d")!, sz = Math.min(img.width, img.height);
      x.fillStyle = "#fff"; x.fillRect(0, 0, n, n); x.drawImage(img, (img.width - sz) / 2, (img.height - sz) / 2, sz, sz, 0, 0, n, n); URL.revokeObjectURL(url);
      let q = .85, d = c.toDataURL("image/jpeg", q); while (d.length > 60000 && q > .4) { q -= .15; d = c.toDataURL("image/jpeg", q); } res(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("read")); }; img.src = url;
  });
}
export async function uploadStaffPhoto(m: Staff | null | undefined, file: File | null | undefined): Promise<void> {
  if (!m || !file || !svc.assets) return;
  if (!/^image\//.test(file.type)) { toast("Choose an image file.", "worried"); return; }
  if (file.size > 2 * 1024 * 1024) { toast("That image is over 2 MB. Choose a smaller one.", "worried"); return; }
  try {
    const r = await svc.assets.upload(file), old = m.photoId; await putDoc("staff", m.id, { photoId: r.id }, true);
    logEvent({ type: "staff", action: "updated", target: m.uid || null, targetLabel: m.uid ? null : m.label, detail: "profile photo changed" });
    if (old) svc.assets.delete(old).catch(() => {}); toast("Photo updated.", "happy");
  } catch (e: any) { toast(e && e.code === "invalid_argument" ? "Only managers can change profile photos." : "The photo didn't upload. Try a PNG or JPG under 2 MB.", "worried"); }
}
/** Remove an agent's uploaded photo ("ag-photo-rm" in the single-file edition). */
export function removeStaffPhoto(m: Staff): void {
  if (!m || !m.photoId) return; const old = m.photoId;
  putDoc("staff", m.id, { photoId: null }, true).then(() => { logEvent({ type: "staff", action: "updated", target: m.uid || null, targetLabel: m.uid ? null : m.label, detail: "profile photo removed" }); if (svc.assets) svc.assets.delete(old).catch(() => {}); }).catch(staffFail);
}
/**
 * Save the agent edit form (saveAgent in the single-file edition).
 * Returns "" when it wasn't saved (a toast says why), or null once saved or when nothing changed (close the editor).
 */
export async function saveAgent(m: Staff, v: { title: string; m365: string; avail: string; oncall: boolean; teams: string[] }): Promise<string | null> {
  const m365 = String(v.m365 || "").trim(); if (m365 && !/^\S+@\S+\.\S+$/.test(m365)) { toast("Enter the full Office 365 email address, or leave it blank.", "worried"); return ""; }
  const title = String(v.title || "").trim(), avail = v.avail, oncall = !!v.oncall, teams = v.teams || [];
  const ch: any = {}, d: string[] = [];
  if (title !== (m.title || "")) { ch.title = title; d.push("job title " + (title || "cleared")); }
  if (m365 !== (m.m365 || "")) { ch.m365 = m365; d.push("Office 365 account " + (m365 || "cleared")); }
  if (avail !== (m.avail || "available")) { ch.avail = avail; d.push(AVAIL[avail]); }
  if (oncall !== !!m.oncall) { ch.oncall = oncall; d.push(oncall ? "on call" : "not on call"); }
  const old = mTeams(m); if (teams.join("|") !== old.join("|")) { ch.teams = teams; ch.team = null; d.push("teams " + (teams.join(", ") || "none")); }
  if (!d.length) return null;
  try { await putDoc("staff", m.id, ch, true); logEvent({ type: "staff", action: "updated", target: m.uid || null, targetLabel: m.uid ? null : m.label, detail: d.join(", ") }); toast("Saved.", "happy"); return null; }
  catch (e) { staffFail(e); return ""; }
}
/** Set an agent's teams. action is "joined" or "left"; team is the one that changed. */
export async function setTeams(m: Staff, teams: string[], action: string, team: string): Promise<void> {
  try { await putDoc("staff", m.id, { teams, team: null }, true); logEvent({ type: "staff", action, target: m.uid || null, targetLabel: m.uid ? null : m.label, detail: team }); } catch (e) { staffFail(e); }
}
/** Delete a team from the settings and from its agents. */
export async function deleteTeam(v: string): Promise<void> {
  if (S.cfg.teams.length <= 1) { toast("Keep at least one team.", "worried"); return; }
  await saveCfg({ teams: S.cfg.teams.filter((x) => x !== v) });
  for (const m of S.staff.filter((m) => mTeams(m).includes(v))) await setTeams(m, mTeams(m).filter((x) => x !== v), "left", v);
}
