/*
 * Requests: agents ask managers for changes only managers can make.
 * Each agent's items live in requests/{uid}; answers in decisions/{itemId}.
 */
import { S, P, svc, ref, commit, toast, openDialog, closeDialog } from "./state.ts";
import { ACTIVE, AVAIL, CH_FIELDS } from "./constants.ts";
import { putDoc, logEvent } from "./data.ts";
import { whoText, staffOf, isMgr } from "./people.ts";
import { assign, setField } from "./tickets.ts";
import { tkKey, planMove, saveQueue, colOwner } from "./queues.ts";
import { staffFail } from "./staff.ts";

let reqKnown: Set<string> | null = null, decKnown: Set<string> | null = null, actx2: any = null;

/** Every request item, newest first, with uid (who asked), status and the decision. */
export function allRequests(): any[] {
  const out: any[] = [];
  for (const d of S.reqDocs) for (const it of (Array.isArray(d.items) ? d.items : [])) if (it && typeof it.id === "string") { const dec = S.decisions[it.id]; out.push(Object.assign({}, it, { uid: d.id, status: dec ? dec.status : "pending", dec: dec || null })); }
  return out.sort((a, b) => a.at < b.at ? 1 : -1);
}
export function myRequests(): any[] { return allRequests().filter((r) => r.uid === S.meId); }
/** A requested photo, only if it's a small, plain image data URL. */
export function safePhoto(v: any): string | null { return typeof v === "string" && v.length < 120000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : null; }
/** The requested value of a profile change, as text. */
export function chValue(r: any): string { if (r.field === "teams") return (Array.isArray(r.value) ? r.value : []).join(", ") || "no team"; if (r.field === "avail") return AVAIL[r.value] || r.value; if (r.field === "oncall") return r.value ? "on call" : "not on call"; return String(r.value || ""); }
/** What a request asks for, after the requester's name: "asks to take HD-123 (Printer offline)". Plain text. */
export function reqText(r: any): string {
  const w = whoText, t = S.byId.get(r.ticketId), tl = r.ticketId || "";
  switch (r.type) {
    case "assign": return (r.to === r.uid ? "asks to take " : "asks to assign ") + tl + (r.to === r.uid ? "" : " to " + w(r.to, r.toLabel)) + ((r.from || r.fromLabel) && r.to !== r.uid ? ", currently with " + w(r.from, r.fromLabel) : (r.from || r.fromLabel) ? " from " + w(r.from, r.fromLabel) : "") + (t ? " (" + t.subject.slice(0, 60) + ")" : "");
    case "unassign": return "asks to unassign " + tl + ((r.from || r.fromLabel) ? " from " + w(r.from, r.fromLabel) : "") + (t ? " (" + t.subject.slice(0, 60) + ")" : "");
    case "photo": return "asks for a new profile photo";
    case "reopen": return "asks to reopen " + tl + (t ? " (" + t.subject.slice(0, 60) + ")" : "");
    case "reorder": {
      const ownr = (r.colUid || r.colLabel) ? (r.colUid === r.uid ? "their" : w(r.colUid, r.colLabel) + "'s") : "the Unassigned";
      return "asks to move " + tl + " to position " + (r.pos || "?") + " in " + ownr + " list" + (t ? " (" + t.subject.slice(0, 60) + ")" : "");
    }
    case "change": return r.field === "other" ? "asks for a change" : "asks to change their " + (CH_FIELDS[r.field] || "details").toLowerCase() + " to " + chValue(r);
    default: return "has a request";
  }
}
/** The request dialog's explanation and summary for a draft (rq-text and rq-sum in the single-file edition). */
export function reqIntro(item: any): { text: string; summary: string } {
  const txt = ({ assign: "Only managers can assign tickets to someone else, or move a ticket that's already assigned.", unassign: "Only managers can unassign a ticket that belongs to someone else.", reorder: "Only managers can change the order of tickets in a list.", reopen: "Only managers can reopen a ticket that's fully closed.", photo: "Profile photos are managed by managers.", change: "Your profile details are managed by managers." } as Record<string, string>)[item.type] || "This needs a manager.";
  return { text: txt + " You can send this to a manager to approve.", summary: "You " + reqText(Object.assign({ uid: S.meId }, item)).replace(/^asks /, "ask ") + "." };
}
export function newReqId(): string { return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
/** Open the request dialog for a draft item ({type, ticketId, …}). */
export function openRequest(item: any): void { openDialog({ kind: "request", draft: item }); }
/** Send the request. Returns an error message to show, false to keep the dialog open without one, or null once sent (the dialog is closed). */
export async function sendRequest(draft: any, message: string): Promise<string | false | null> {
  const it = draft; if (!it || !S.meId) return false;
  const note = String(message || "").trim();
  if (it.type === "change" && it.field === "other" && !note) return "Describe what you'd like changed.";
  const mine = S.reqDocs.find((d) => d.id === S.meId), items = (mine && Array.isArray(mine.items) ? mine.items : []).slice();
  if (items.some((x: any) => !S.decisions[x.id] && x.type === it.type && x.ticketId === it.ticketId && x.to === it.to && x.field === it.field && x.pos === it.pos && it.type !== "photo" && it.type !== "change")) return "You've already asked for this. A manager will pick it up.";
  const rec = Object.assign({ id: newReqId(), at: new Date().toISOString(), note }, it);
  items.push(rec);
  while (items.length > 25) { const i = items.findIndex((x: any) => S.decisions[x.id]); if (i < 0) break; items.splice(i, 1); }
  try {
    await ref.db.doc("requests/" + S.meId).set({ items });
    const d = S.reqDocs.filter((x) => x.id !== S.meId); d.push({ id: S.meId, items }); S.reqDocs = d;
    logEvent({ type: "request", action: "created", target: S.meId, detail: reqText(Object.assign({ uid: S.meId }, rec)) });
    closeDialog(); commit(); toast("Request sent to the managers.", "happy"); return null;
  } catch (e: any) { return e && e.code === "quota_exceeded" ? "Your request list is full. Ask a manager to clear old requests." : "The request didn't send. Check your connection and try again."; }
}
export function b64ToBlob(dataUrl: string): Blob { const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/)!, bin = atob(m[2]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: m[1] }); }

/** Record a decision (decide(r, status, reason) in the single-file edition). */
async function record(r: any, status: string, reason?: string): Promise<boolean> {
  const rec = { status, by: S.meId || null, at: new Date().toISOString(), reason: reason || "", req: r.uid };
  try {
    await ref.db.collection("decisions").doc(r.id).set(rec); S.decisions = Object.assign({}, S.decisions, { [r.id]: rec });
    logEvent({ type: "request", action: status, target: r.uid, detail: reqText(r) + (reason ? ". Reason: " + reason : "") }); commit(); return true;
  } catch (e: any) { toast(e && e.code === "invalid_argument" ? "Only managers can answer requests." : "That didn't save. Check your connection and try again.", "worried"); return false; }
}
/**
 * Approve or decline one request item. requestKey is the requester's uid (the requests doc id).
 * Approving does what the request asks and toasts "Approved."; declining doesn't toast (the caller toasts "Declined.").
 */
export async function decide(requestKey: string, itemId: string, approve: boolean, reason?: string): Promise<boolean> {
  const r = allRequests().find((x) => x.uid === requestKey && x.id === itemId) || allRequests().find((x) => x.id === itemId);
  if (!r) return false;
  if (approve) return approveRequest(r);
  return record(r, "declined", String(reason || "").trim().slice(0, 200));
}
/** Carry out what the request asks for, then record the approval. */
export async function approveRequest(r: any): Promise<boolean> {
  if (r.type === "assign" || r.type === "unassign") {
    const t = S.byId.get(r.ticketId); if (!t) { toast("That ticket no longer exists, so the request was declined.", "worried"); return record(r, "declined", "The ticket no longer exists"); }
    const to = r.type === "assign" ? (r.to || null) : null, tl = r.type === "assign" ? (r.toLabel || null) : null;
    if ((t.assigneeId || null) !== to || (t.assigneeLabel || null) !== tl) { const ok = await assign(t.id, to, tl); if (!ok) return false; }
  } else if (r.type === "reopen") {
    const t = S.byId.get(r.ticketId); if (!t) { toast("That ticket no longer exists, so the request was declined.", "worried"); return record(r, "declined", "The ticket no longer exists"); }
    if (!ACTIVE.has(t.status) && !(await setField(t.id, "status", "open"))) return false;
  } else if (r.type === "reorder") {
    const t = S.byId.get(r.ticketId);
    if (!t || !ACTIVE.has(t.status) || tkKey(t) !== r.qkey) { toast("That ticket has moved or closed since, so the request was declined.", "worried"); return record(r, "declined", "The ticket has moved or closed since this was asked"); }
    const plan = planMove(r.qkey, r.ticketId, r.before, r.after);
    if (plan && !(await saveQueue(r.qkey, plan.order, colOwner(r.qkey), r.ticketId + " to position " + plan.pos))) return false;
  } else if (r.type === "photo") {
    const m = staffOf(r.uid), ph = safePhoto(r.photo);
    if (!m) { toast("Add this person under Admin, Agents first.", "worried"); return false; }
    if (!ph || !svc.assets) { toast(svc.assets ? "The photo in this request can't be read." : "Photo uploads aren't available in this view.", "worried"); return false; }
    try { const up = await svc.assets.upload(b64ToBlob(ph)), old = m.photoId; await putDoc("staff", m.id, { photoId: up.id }, true); if (old) svc.assets.delete(old).catch(() => {}); }
    catch (e) { toast("The photo didn't upload. Try again.", "worried"); return false; }
  } else if (r.type === "change" && r.field !== "other") {
    const m = staffOf(r.uid); if (!m) { toast("Add this person under Admin, Agents first.", "worried"); return false; }
    const ch: any = {};
    if (r.field === "title") ch.title = String(r.value || "").slice(0, 60);
    else if (r.field === "teams") ch.teams = (Array.isArray(r.value) ? r.value : []).filter((t: any) => typeof t === "string").slice(0, 40);
    else if (r.field === "avail" && AVAIL[r.value]) ch.avail = r.value;
    else if (r.field === "oncall") ch.oncall = !!r.value;
    else if (r.field === "m365") { if (!/^\S+@\S+\.\S+$/.test(String(r.value || ""))) { toast("That Office 365 address doesn't look right. Decline it and ask for a correction.", "worried"); return false; } ch.m365 = String(r.value).slice(0, 120); }
    if (Object.keys(ch).length) { try { await putDoc("staff", m.id, Object.assign(ch, ch.teams ? { team: null } : {}), true); } catch (e) { staffFail(e); return false; } }
  }
  const ok = await record(r, "approved", ""); if (ok) toast("Approved.", "happy"); return ok;
}
/** Ids of decided requests this person has already seen (helpdesk.reqSeen). */
export function seenSet(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem("helpdesk.reqSeen") || "[]")); } catch (e) { return new Set(); } }
/** Mark your decided requests as seen (opening the bell or the Requests tab of Account settings). */
export function markSeen(): void {
  const all = new Set([...seenSet(), ...myRequests().filter((r) => r.status !== "pending").map((r) => r.id)]);
  try { localStorage.setItem("helpdesk.reqSeen", JSON.stringify([...all].slice(-200))); } catch (e) { /* storage blocked */ }
  commit();
}
/** After requests or decisions change: tell managers about new requests and agents about answers. Sets S.bellRing to ring the bell. */
export function noticeChanges(): void {
  const all = allRequests(), pend = new Set(all.filter((r) => r.status === "pending").map((r) => r.id)), dec = new Set(Object.keys(S.decisions));
  if (reqKnown && isMgr()) {
    const known = reqKnown, fresh = all.filter((r) => pend.has(r.id) && !known.has(r.id) && r.uid !== S.meId);
    if (fresh.length) {
      S.bellRing = Date.now();
      if (P.notifyNew) toast(fresh.length === 1 ? whoText(fresh[0].uid, null) + " sent a request." : fresh.length + " new requests.", "happy");
      if (P.notifySound) chime();
    }
  }
  if (decKnown) {
    const known = decKnown, mine = all.filter((r) => r.uid === S.meId && r.status !== "pending" && !known.has(r.id));
    if (mine.length && P.notifyDecisions) { const r = mine[0]; toast("Your request was " + r.status + (r.dec && r.dec.reason ? ": " + r.dec.reason : "."), r.status === "approved" ? "party" : "worried"); }
  }
  reqKnown = new Set(all.map((r) => r.id)); decKnown = dec;
}
/** A short two-note chime. */
export function chime(): void {
  try {
    const w: any = window; actx2 = actx2 || new (w.AudioContext || w.webkitAudioContext)(); const t = actx2.currentTime;
    [880, 1320].forEach((f, i) => { const o = actx2.createOscillator(), g = actx2.createGain(); o.frequency.value = f; g.gain.setValueAtTime(.0001, t + i * .12); g.gain.exponentialRampToValueAtTime(.08, t + i * .12 + .02); g.gain.exponentialRampToValueAtTime(.0001, t + i * .12 + .4); o.connect(g); g.connect(actx2.destination); o.start(t + i * .12); o.stop(t + i * .12 + .45); });
  } catch (e) { /* no audio */ }
}
