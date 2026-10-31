/* Customer records: details, SLA overrides, contacts, sites and logos. Actions act on S.selCust unless a customer id is given. */
import { S, svc, commit, toast } from "./state.ts";
import { TIERS } from "./constants.ts";
import { slug } from "./format.ts";
import { enqueue, putDoc, logEvent, writeFailed, newId } from "./data.ts";
import { maxIdNum, nextIdNum } from "./tickets.ts";
import type { Contact, Customer } from "./types.ts";

export function newCustId(name: string): string { let id = "c-" + slug(name); while (S.custById.has(id)) id = "c-" + slug(name) + "-" + Math.random().toString(36).slice(2, 5); return id; }
/** Create a customer record. Resolves to its id. */
export function createCustomer(name: string): Promise<string> {
  const id = newCustId(name), now = new Date().toISOString();
  const body = { name, priority: "N", allHours: false, sla: {}, notes: "", contacts: [], logoId: null, createdAt: now, updatedAt: now };
  return enqueue("cust:" + id, async () => { await putDoc("customers", id, body); logEvent({ type: "customer", action: "created", ref: id, name }); return id; });
}
/** Change a customer. `build(c)` returns {changes, event} or null for no change. */
export function updateCustomer(cid: string | null | undefined, build: (c: Customer) => { changes: any; event?: any } | null | undefined): Promise<boolean> {
  return enqueue("cust:" + cid, async () => {
    const c = cid ? S.custById.get(cid) : undefined; if (!c) return false;
    const r = build(c); if (!r) return false;
    await putDoc("customers", c.id, Object.assign({}, r.changes, { updatedAt: new Date().toISOString() }), true);
    logEvent(Object.assign({ type: "customer", ref: c.id, name: r.changes.name || c.name }, r.event)); return true;
  }).catch((e) => { writeFailed(e); return false; });
}
/** Change one account field: name, priority, allHours ("1" or ""), idPrefix, idStart or notes. */
export function custField(k: string, v: any, cid: string | null = S.selCust): Promise<void> {
  return updateCustomer(cid, (c) => {
    if (k === "name") {
      v = String(v).trim(); if (!v || v === c.name) return null; const ex = S.custByName.get(v.toLowerCase()); if (ex && ex.id !== c.id) { toast("Another customer already has that name.", "worried"); return null; }
      return { changes: { name: v }, event: { action: "updated", detail: "Name " + c.name + " → " + v } };
    }
    if (k === "priority") { if (v === c.priority) return null; return { changes: { priority: v }, event: { action: "updated", detail: "Priority " + (TIERS[c.priority] || "Normal") + " → " + TIERS[v] } }; }
    if (k === "allHours") { const b = v === "1" || v === true; if (b === !!c.allHours) return null; return { changes: { allHours: b }, event: { action: "updated", detail: b ? "Support hours set to 24/7" : "Support hours set to working hours" } }; }
    if (k === "idPrefix") {
      v = String(v).trim().toUpperCase(); if (v === (c.idPrefix || "")) return null;
      if (v && !/^[A-Z0-9]{1,6}$/.test(v)) { toast("The prefix can be 1 to 6 letters or numbers, like FAI.", "worried"); return null; }
      const dup = v && S.customers.find((x) => x.id !== c.id && (x.idPrefix || "") === v); if (dup) { toast(dup.name + " already uses " + v + ". Each customer needs its own prefix.", "worried"); return null; }
      return { changes: { idPrefix: v || null }, event: { action: "updated", detail: v ? "Ticket ID prefix " + (c.idPrefix ? c.idPrefix + " → " : "set to ") + v : "Ticket ID prefix removed" } };
    }
    if (k === "idStart") {
      if (!c.idPrefix) return null; const n = parseInt(String(v).trim(), 10);
      if (!(n >= 1 && n <= 9999999)) { toast("Enter a whole number, like 8.", "worried"); return null; }
      const min = maxIdNum(c.idPrefix) + 1; if (n < min) { toast(c.idPrefix + (min - 1) + " already exists, so the next number has to be " + min + " or higher.", "worried"); return null; }
      if (n === nextIdNum(c)) return null;
      return { changes: { idStart: n }, event: { action: "updated", detail: "Next ticket number set to " + c.idPrefix + n } };
    }
    if (k === "notes") { if (v === (c.notes || "")) return null; return { changes: { notes: v }, event: { action: "updated", detail: "Account notes edited" } }; }
    return null;
  }).then(() => { commit(); });
}
/** Set (or clear, with "") the customer's own target for a severity, in hours. */
export function custSla(k: string, v: any, cid: string | null = S.selCust): void {
  const h = String(v).trim() === "" ? null : parseFloat(v);
  if (h !== null && !(h > 0 && h <= 2000)) { toast("Enter a target between 0 and 2000 hours, or leave it blank.", "worried"); commit(); return; }
  updateCustomer(cid, (c) => {
    const old = (c.sla && +(c.sla as any)[k]) || null; if (old === h) return null; const sl: any = Object.assign({}, c.sla || {}); sl[k] = h;
    return { changes: { sla: sl }, event: { action: "updated", detail: k + " target " + (old ? old + "h" : "default") + " → " + (h ? h + "h" : "default") } };
  });
}
/** Add (id "new") or edit a contact. `site` is a site id. Returns an error message, or null when it's being saved. */
export function saveContact(id: string, f: { name?: string; role?: string; email?: string; phone?: string; site?: string }, cid: string | null = S.selCust): string | null {
  const c = cid ? S.custById.get(cid) : undefined; if (!c || !f) return null;
  const v = { name: (f.name || "").trim(), role: (f.role || "").trim(), email: (f.email || "").trim(), phone: (f.phone || "").trim(), siteId: (c.sites || []).some((x) => x.id === f.site) ? f.site as string : "" };
  if (!v.name) return "Add the contact's name.";
  if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) return "That email address doesn't look complete.";
  const isNew = id === "new", kid = isNew ? "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) : id;
  updateCustomer(c.id, (cc) => {
    const list = (cc.contacts || []).slice(), i = list.findIndex((k) => k.id === kid), e: Contact = Object.assign({ id: kid }, v); if (i >= 0) list[i] = e; else list.push(e);
    return { changes: { contacts: list }, event: { action: isNew ? "contact-added" : "contact-updated", detail: v.name } };
  });
  return null;
}
export function removeContact(kid: string, cid: string | null = S.selCust): Promise<boolean> {
  return updateCustomer(cid, (c) => {
    const k = (c.contacts || []).find((x) => x.id === kid); if (!k) return null;
    return { changes: { contacts: (c.contacts || []).filter((x) => x.id !== kid) }, event: { action: "contact-removed", detail: k.name } };
  });
}
export async function uploadLogo(file: File | null | undefined, cid: string | null = S.selCust): Promise<void> {
  const c = cid ? S.custById.get(cid) : undefined; if (!file || !c || !svc.assets) return;
  if (!/^image\//.test(file.type)) { toast("Choose an image file for the logo.", "worried"); return; }
  if (file.size > 2 * 1024 * 1024) { toast("That image is over 2 MB. Choose a smaller one.", "worried"); return; }
  try {
    const r = await svc.assets.upload(file), old = c.logoId;
    const ok = await updateCustomer(c.id, () => ({ changes: { logoId: r.id }, event: { action: "updated", detail: old ? "Logo replaced" : "Logo added" } }));
    if (ok && old) svc.assets.delete(old).catch(() => {});
  } catch (e) { toast("The logo didn't upload. Try a PNG or JPG under 2 MB.", "worried"); }
}
export function removeLogo(cid: string | null = S.selCust): void {
  const c = cid ? S.custById.get(cid) : undefined; if (!c || !c.logoId) return; const old = c.logoId;
  updateCustomer(c.id, () => ({ changes: { logoId: null }, event: { action: "updated", detail: "Logo removed" } })).then((ok) => { if (ok && svc.assets) svc.assets.delete(old).catch(() => {}); });
}
/** Add (id "new") or edit a site. Returns an error message, or null when it's being saved. */
export function saveSite(id: string, f: { name?: string; address?: string }, cid: string | null = S.selCust): string | null {
  const c = cid ? S.custById.get(cid) : undefined; if (!c || !f) return null;
  const v = { name: (f.name || "").trim().slice(0, 80), address: (f.address || "").trim().slice(0, 300) };
  if (!v.name) return "Give the site a name, like Head office or the town it's in.";
  const isNew = id === "new", sid = isNew ? newId("s") : id;
  updateCustomer(c.id, (cc) => {
    const list = (cc.sites || []).slice(), i = list.findIndex((x) => x.id === sid), e = Object.assign({ id: sid }, v); if (i >= 0) list[i] = e; else list.push(e);
    return { changes: { sites: list }, event: { action: "updated", detail: (isNew ? "Site added: " : "Site updated: ") + v.name } };
  });
  return null;
}
/** Remove a site; its contacts lose their site. */
export function removeSite(sid: string, cid: string | null = S.selCust): Promise<boolean> {
  return updateCustomer(cid, (c) => {
    const st = (c.sites || []).find((x) => x.id === sid); if (!st) return null;
    return { changes: { sites: (c.sites || []).filter((x) => x.id !== sid), contacts: (c.contacts || []).map((k) => k.siteId === sid ? Object.assign({}, k, { siteId: "" }) : k) }, event: { action: "updated", detail: "Site removed: " + st.name } };
  });
}
/** Contacts matching a caller's name, email, role or (4+ digits of) phone number. At most 8. */
export function callerMatches(q: string): { c: Customer; k: Contact }[] {
  q = q.trim().toLowerCase(); if (q.length < 2) return []; const digits = q.replace(/\D/g, ""), out: { c: Customer; k: Contact }[] = [];
  for (const c of S.customers) for (const k of c.contacts || []) {
    const hay = (k.name + " " + (k.email || "") + " " + (k.role || "")).toLowerCase(), ph = String(k.phone || "").replace(/\D/g, "");
    if (hay.includes(q) || (digits.length >= 4 && ph.includes(digits))) out.push({ c, k });
  }
  return out.slice(0, 8);
}
