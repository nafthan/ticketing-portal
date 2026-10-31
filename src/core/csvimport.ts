/* Importing customers, contacts and tickets from CSV: parse, plan (preview), then save. */
import { S, ref, commit, toast, openDialog, closeDialog } from "./state.ts";
import { ST_LABEL, IMP_COLS } from "./constants.ts";
import { abs, plural } from "./format.ts";
import { save, putDoc, logEvent, newId, withRetry, index, saveLocal, writeFailed } from "./data.ts";
import { staffName, isMgr } from "./people.ts";
import { allocId } from "./tickets.ts";
import { newCustId, createCustomer, updateCustomer } from "./customers.ts";
import { csv } from "./exports.ts";

/** Parse CSV text into rows. Handles quotes, a BOM, CRLF, and comma, semicolon or tab separators. Blank rows are dropped. */
export function parseCSV(text: any): string[][] {
  text = String(text).replace(/^﻿/, "");
  const first = text.split(/\r?\n/, 1)[0] || "", cnt = (c: string) => first.split(c).length - 1, dl = [",", ";", "\t"].sort((a, b) => cnt(b) - cnt(a))[0];
  const rows: string[][] = []; let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === dl) { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); f = ""; if (row.some((x) => x.trim() !== "")) rows.push(row); row = []; }
    else f += c;
  }
  row.push(f); if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}
/** CSV rows as objects keyed by our column names (see IMP_COLS), each with _row (the line number). */
export function csvObjects(text: string, cols: Record<string, string[]>): { head: (string | null)[]; list: any[]; unknown: string[] } {
  const rows = parseCSV(text); if (!rows.length) return { head: [], list: [], unknown: [] };
  const norm = (h: any) => String(h).toLowerCase().replace(/[^a-z0-9]/g, ""), map: Record<string, string> = {};
  for (const [key, names] of Object.entries(cols)) for (const n of names) map[norm(n)] = key;
  const head = rows[0].map((h) => map[norm(h)] || null), unknown = rows[0].filter((h, i) => !head[i] && String(h).trim());
  const list = rows.slice(1).map((r, n) => { const o: any = { _row: n + 2 }; head.forEach((k, i) => { if (k && r[i] != null && String(r[i]).trim() !== "") o[k] = String(r[i]).trim(); }); return o; });
  return { head, list, unknown };
}
/** Offer a template CSV ("customers" or "tickets"). */
export function importTemplate(k: string): Promise<void> {
  const rows = k === "customers" ? [["Customer", "Contact name", "Email", "Phone", "Role", "Site", "Site address", "Priority", "Ticket ID prefix"],
    ["Acme Ltd", "Jo Bloggs", "jo@acme.example", "01632 960000", "Office manager", "Head office", "1 High Street, Anytown", "High", "ACME"]]
    : [["ID", "Subject", "Description", "Customer", "Requester", "Requester email", "Category", "Team", "Severity", "Status", "Assignee", "Channel", "Opened", "Resolved", "Closed", "Resolution"],
      ["ACME1", "Printer offline", "Reception printer shows offline", "Acme Ltd", "Jo Bloggs", "jo@acme.example", S.cfg.categories[0] || "Hardware", S.cfg.teams[0] || "Service desk", "S3", "Closed", "Sam Smith", "Email", "2026-01-12 09:30", "2026-01-12 11:05", "2026-01-15 09:00", "Re-added the printer queue"]];
  return save("helpdesk-" + k + "-template.csv", csv(rows));
}
export function sevFrom(v: any): string | null {
  v = String(v || "").toLowerCase().trim(); if (!v) return null; const m = v.match(/^s?([1-4])\b/); if (m) return "S" + m[1];
  if (/crit|urgent|p1/.test(v)) return "S1"; if (/high|p2/.test(v)) return "S2"; if (/med|normal|moderate|p3/.test(v)) return "S3"; if (/low|minor|p4|p5/.test(v)) return "S4"; return null;
}
export function statusFrom(v: any): string | null {
  v = String(v || "").toLowerCase().trim(); if (!v) return null;
  if (/clos|done|complete|cancel/.test(v)) return "closed"; if (/resol|fixed/.test(v)) return "resolved"; if (/pend|wait|hold/.test(v)) return "pending"; if (/new|unassigned/.test(v)) return "new"; if (/open|progress|assigned|active|working/.test(v)) return "open"; return null;
}
export function tierFrom(v: any): string | null { v = String(v || "").toLowerCase().trim(); if (!v) return null; if (/^c|crit/.test(v)) return "C"; if (/^h|high/.test(v)) return "H"; if (/^l|low/.test(v)) return "L"; if (/^n|norm|med/.test(v)) return "N"; return null; }
export function chanFrom(v: any): string | null { v = String(v || "").toLowerCase(); if (!v) return null; if (/mail/.test(v)) return "email"; if (/phone|call|tel/.test(v)) return "phone"; if (/portal|web|form/.test(v)) return "portal"; if (/chat|teams|slack/.test(v)) return "chat"; if (/monit|alert|rmm/.test(v)) return "monitoring"; return null; }
/** A date as ISO. Accepts ISO-ish dates and UK dd/mm/yyyy. */
export function dateFrom(v: any): string | null {
  if (!v) return null; let s = String(v).trim(); const uk = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})(.*)$/); if (uk) s = uk[3] + "-" + uk[2].padStart(2, "0") + "-" + uk[1].padStart(2, "0") + uk[4];
  const d = new Date(s.replace(" ", "T")); return isNaN(+d) ? null : d.toISOString();
}

/** Plan a customer import: grouped by customer, with only what's new. */
export function planCustomers(list: any[]): any {
  const warn: string[] = [], by = new Map<string, any>(), prefixes = new Map<string, string>(S.customers.filter((c) => c.idPrefix).map((c) => [c.idPrefix as string, c.id]));
  let contacts = 0, sites = 0, skipped = 0;
  for (const r of list) {
    if (!r.customer) { skipped++; warn.push("Row " + r._row + ": no customer name, skipped."); continue; }
    const key = r.customer.toLowerCase(); let g = by.get(key);
    if (!g) { const ex = S.custByName.get(key); g = { name: r.customer.slice(0, 80), existing: ex || null, contacts: [], sites: [], priority: null, prefix: null, notes: null }; by.set(key, g); }
    if (r.site && !g.sites.some((x: any) => x.name.toLowerCase() === r.site.toLowerCase()) && !(g.existing && (g.existing.sites || []).some((x: any) => x.name.toLowerCase() === r.site.toLowerCase()))) { g.sites.push({ name: r.site.slice(0, 80), address: (r.address || "").slice(0, 300) }); sites++; }
    if (r.contact || r.email) {
      if (r.email && !/^\S+@\S+\.\S+$/.test(r.email)) warn.push("Row " + r._row + ": " + r.email + " doesn't look like an email address; kept anyway.");
      const same = (k: any) => (r.email && k.email && k.email.toLowerCase() === r.email.toLowerCase()) || (!r.email && k.name && r.contact && k.name.toLowerCase() === r.contact.toLowerCase());
      if (!g.contacts.some(same) && !(g.existing && (g.existing.contacts || []).some(same))) { g.contacts.push({ name: (r.contact || r.email).slice(0, 80), email: (r.email || "").slice(0, 200), phone: (r.phone || "").slice(0, 40), role: (r.role || "").slice(0, 80), site: r.site || "" }); contacts++; }
    }
    if (r.priority) { const t = tierFrom(r.priority); if (t) g.priority = t; else warn.push("Row " + r._row + ": priority " + r.priority + " isn't Critical, High, Normal or Low; ignored."); }
    if (r.prefix) {
      const pf = r.prefix.toUpperCase();
      if (!/^[A-Z0-9]{1,6}$/.test(pf)) warn.push("Row " + r._row + ": prefix " + r.prefix + " must be 1 to 6 letters or numbers; ignored.");
      else if (prefixes.has(pf) && prefixes.get(pf) !== (g.existing && g.existing.id) && prefixes.get(pf) !== key) warn.push("Row " + r._row + ": prefix " + pf + " is already used by another customer; ignored.");
      else if (g.existing && g.existing.idPrefix && g.existing.idPrefix !== pf) warn.push(g.name + " already has the prefix " + g.existing.idPrefix + "; kept it.");
      else { g.prefix = pf; prefixes.set(pf, g.existing ? g.existing.id : key); }
    }
    if (r.notes && !g.notes) g.notes = r.notes.slice(0, 2000);
  }
  const all = [...by.values()], groups = all.filter((g) => !g.existing || g.contacts.length || g.sites.length || (g.priority && g.priority !== g.existing.priority) || (g.prefix && !g.existing.idPrefix)), nw = groups.filter((g) => !g.existing).length;
  if (all.length && !groups.length) warn.unshift("Everything in this file is already here, so there's nothing new to import.");
  return {
    groups, warn, skipped, sum: [[nw, "new customer"], [groups.length - nw, "existing customer with new details", "existing customers with new details"], [contacts, "contact"], [sites, "site"]],
    preview: { head: ["Customer", "", "Contacts", "Sites", "Prefix"], rows: groups.slice(0, 50).map((g) => [g.name, g.existing ? "Existing" : "New", String(g.contacts.length), String(g.sites.length), g.prefix || (g.existing && g.existing.idPrefix) || ""]) },
  };
}
/** Plan a ticket import. */
export function planTickets(list: any[]): any {
  const warn: string[] = [], out: any[] = [], ids = new Set<string>(), newCust = new Set<string>(), unknownCat = new Set<string>(), unknownTeam = new Set<string>(); let skipped = 0;
  const staffBy = new Map(S.staff.map((m) => [staffName(m).toLowerCase(), m]));
  for (const r of list) {
    if (!r.subject) { skipped++; warn.push("Row " + r._row + ": no subject, skipped."); continue; }
    let id = r.id ? r.id.replace(/\s+/g, "") : null;
    if (id && !/^[A-Za-z0-9-]{1,40}$/.test(id)) { warn.push("Row " + r._row + ": ID " + r.id + " has characters IDs can't use; a new ID will be given."); id = null; }
    if (id && (S.byId.has(id) || ids.has(id))) { skipped++; warn.push("Row " + r._row + ": " + id + " already exists, skipped."); continue; }
    if (id) ids.add(id);
    const sev = sevFrom(r.severity), st = statusFrom(r.status) || (r.closed ? "closed" : r.resolved ? "resolved" : "open");
    if (r.severity && !sev) warn.push("Row " + r._row + ": severity " + r.severity + " not recognised; set to S3.");
    if (r.status && !statusFrom(r.status)) warn.push("Row " + r._row + ": status " + r.status + " not recognised; set to " + ST_LABEL[st] + ".");
    const opened = dateFrom(r.opened) || new Date().toISOString(); if (r.opened && !dateFrom(r.opened)) warn.push("Row " + r._row + ": opened date " + r.opened + " not recognised; set to now.");
    const done = st === "resolved" || st === "closed", resolvedAt = done ? (dateFrom(r.resolved) || dateFrom(r.closed) || opened) : null, closedAt = st === "closed" ? (dateFrom(r.closed) || resolvedAt) : null;
    const c = r.customer ? S.custByName.get(r.customer.toLowerCase()) : null; if (r.customer && !c) newCust.add(r.customer.slice(0, 80));
    const cat = r.category || S.cfg.categories[0] || "General", team = r.team || S.cfg.defaults.team || S.cfg.teams[0] || "Service desk";
    if (!S.cfg.categories.includes(cat)) unknownCat.add(cat); if (!S.cfg.teams.includes(team)) unknownTeam.add(team);
    let asg: any = null;
    if (r.assignee) {
      const a = r.assignee.toLowerCase(), m = staffBy.get(a), known = Object.keys(S.names).find((k) => String(S.names[k]).toLowerCase() === a);
      asg = m ? { uid: m.uid || null, label: m.uid ? null : m.label } : known ? { uid: known, label: null } : { uid: null, label: r.assignee.slice(0, 80) };
    }
    out.push({ id, r, sev: sev || "S3", st, opened, resolvedAt, closedAt, customer: r.customer || "", cat, team, asg, chan: chanFrom(r.channel) });
  }
  if (newCust.size) warn.unshift(newCust.size + " customer" + (newCust.size === 1 ? "" : "s") + " not found will be created: " + [...newCust].slice(0, 6).join(", ") + (newCust.size > 6 ? "…" : "") + ".");
  if (unknownCat.size) warn.unshift("Categories not in your list, kept as written: " + [...unknownCat].slice(0, 8).join(", ") + ". Add them in Admin, Categories if you want them in the menus.");
  if (unknownTeam.size) warn.unshift("Teams not in your list, kept as written: " + [...unknownTeam].slice(0, 8).join(", ") + ".");
  const unmatched = new Set(out.filter((x) => x.asg && !x.asg.uid && !S.staff.some((m) => m.label === x.asg.label)).map((x) => x.asg.label));
  if (unmatched.size) warn.unshift("Assignees not on your team list are kept as names: " + [...unmatched].slice(0, 6).join(", ") + (unmatched.size > 6 ? "…" : "") + ". Add them in Admin, Agents to link them.");
  const by = (k: string) => out.filter((x) => x.st === k).length;
  return {
    rows: out, newCust: [...newCust], warn, skipped, sum: [[out.length, "ticket"], [by("closed"), "closed", "closed"], [out.length - by("closed"), "open or resolved", "open or resolved"], [newCust.size, "new customer"]],
    preview: { head: ["ID", "Subject", "Customer", "Status", "Opened"], rows: out.slice(0, 50).map((x) => [x.id || "New ID", x.r.subject, x.customer, ST_LABEL[x.st], abs(x.opened).slice(0, 10)]) },
  };
}
/**
 * Read a CSV file and open the import preview ({kind:"import", plan}).
 * plan: planCustomers()/planTickets() plus kind ("customers" | "tickets"), unknown (ignored columns) and file (name).
 */
export function readImport(kind: string, file: File): void {
  if (!isMgr()) { toast("Only managers can import.", "worried"); return; }
  file.text().then((text) => {
    const { list, unknown } = csvObjects(text, IMP_COLS[kind]);
    const plan = kind === "customers" ? planCustomers(list) : planTickets(list); plan.kind = kind; plan.unknown = unknown; plan.file = file.name;
    openDialog({ kind: "import", plan });
  }).catch(() => toast("That file couldn't be read. Save it as CSV and try again.", "worried"));
}
/** Save a planned import. onProgress(done, total) after each record. Closes the dialog and resolves true when done. */
export async function runImport(plan: any, onProgress?: (done: number, total: number) => void): Promise<boolean> {
  const I = plan; if (!I) return false; const progress = (d: number, t: number) => { if (onProgress) onProgress(d, t); };
  try {
    if (I.kind === "customers") {
      let n = 0;
      for (const g of I.groups) {
        if (g.existing) {
          const ch: any = {}, cur = S.custById.get(g.existing.id) || g.existing, sites = (cur.sites || []).slice();
          for (const st of g.sites) sites.push({ id: newId("s"), name: st.name, address: st.address });
          const sid = (nm: any) => { const x = sites.find((y: any) => y.name.toLowerCase() === String(nm || "").toLowerCase()); return x ? x.id : ""; };
          if (g.sites.length) ch.sites = sites;
          if (g.contacts.length) ch.contacts = (cur.contacts || []).concat(g.contacts.map((k: any) => ({ id: newId("k"), name: k.name, email: k.email, phone: k.phone, role: k.role, siteId: sid(k.site) })));
          if (g.priority && g.priority !== cur.priority) ch.priority = g.priority;
          if (g.prefix && !cur.idPrefix) ch.idPrefix = g.prefix;
          if (Object.keys(ch).length) await updateCustomer(cur.id, () => ({ changes: ch, event: { action: "updated", detail: "Imported: " + [g.contacts.length && g.contacts.length + " contacts", g.sites.length && g.sites.length + " sites"].filter(Boolean).join(", ") || "details" } }));
        } else {
          const id = newCustId(g.name), now = new Date().toISOString(), sites = g.sites.map((st: any) => ({ id: newId("s"), name: st.name, address: st.address }));
          const sid = (nm: any) => { const x = sites.find((y: any) => y.name.toLowerCase() === String(nm || "").toLowerCase()); return x ? x.id : ""; };
          const body: any = {
            name: g.name, priority: g.priority || "N", allHours: false, sla: {}, notes: g.notes || "", logoId: null, createdAt: now, updatedAt: now, sites,
            contacts: g.contacts.map((k: any) => ({ id: newId("k"), name: k.name, email: k.email, phone: k.phone, role: k.role, siteId: sid(k.site) })), imported: true,
          };
          if (g.prefix) body.idPrefix = g.prefix;
          await putDoc("customers", id, body); logEvent({ type: "customer", action: "created", ref: id, name: g.name, detail: "Imported from CSV" });
        }
        progress(++n, I.groups.length);
      }
      closeDialog(); toast("Imported " + plural(I.groups.length, "customer") + ".", "party");
    } else {
      for (const name of I.newCust) if (!S.custByName.get(name.toLowerCase())) await createCustomer(name);
      const made: any[] = []; let n = 0;
      for (const x of I.rows) {
        const c = x.customer ? S.custByName.get(x.customer.toLowerCase()) : null;
        let id = x.id; if (!id) id = await allocId(c ? c.id : null);
        const ev: any[] = [{ at: x.opened, type: "created", byLabel: "Import", imported: true }];
        if (x.st !== "new") ev.push({ at: x.resolvedAt || x.opened, type: "status", from: "new", to: x.st === "closed" && x.resolvedAt ? "resolved" : x.st, byLabel: "Import", auto: true, reason: "Imported" });
        if (x.st === "closed") ev.push({ at: x.closedAt || x.resolvedAt || x.opened, type: "status", from: "resolved", to: "closed", byLabel: "Import", auto: true, reason: "Imported" });
        const notes = x.r.resolution ? [{ at: x.resolvedAt || x.opened, text: x.r.resolution.slice(0, 6000), internal: false, minutes: 0, byLabel: "Import" }] : [];
        const site = c && x.r.site ? (c.sites || []).find((s) => s.name.toLowerCase() === x.r.site.toLowerCase()) : null;
        const body = {
          subject: x.r.subject.slice(0, 200), description: (x.r.description || "").slice(0, 20000), customer: c ? c.name : x.customer, customerId: c ? c.id : null, contactId: null,
          requesterName: (x.r.requester || "").slice(0, 80), requesterEmail: (x.r.email || "").slice(0, 200), requesterPhone: (x.r.phone || "").slice(0, 40), channel: x.chan, siteId: site ? site.id : null, site: site ? site.name : (x.r.site || ""),
          team: x.team, category: x.cat, severity: x.sev, status: x.st, assigneeId: x.asg ? x.asg.uid : null, assigneeLabel: x.asg ? x.asg.label : null,
          createdAt: x.opened, updatedAt: x.closedAt || x.resolvedAt || x.opened, resolvedAt: x.resolvedAt, closedAt: x.closedAt || null, createdBy: S.meId, notes, timeline: [], incident: false, history: ev, imported: true,
        };
        if (ref.db) await withRetry(() => ref.col.doc(id).set(body));
        made.push(Object.assign({ id }, body)); S.byId.set(id, Object.assign({ id }, body) as any);
        progress(++n, I.rows.length);
      }
      if (!ref.db) { index(made.concat(S.tickets)); saveLocal(); }
      logEvent({ type: "settings", detail: "Imported " + made.length + " tickets from CSV" });
      closeDialog(); commit(); toast("Imported " + plural(made.length, "ticket") + ".", "party");
    }
    return true;
  } catch (e) { writeFailed(e); return false; }
}
