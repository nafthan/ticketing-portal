/*
 * The New ticket dialog: #dlg, openDialog, fillContacts, fillSites, submitDialog,
 * the caller lookup, similar past tickets and the auto-assign preview in the
 * single-file edition.
 */
import { useEffect, useRef, useState } from "react";
import { S, P, TICKET_VIEWS, closeDialog, toast } from "../core/state.ts";
import { SEV, CHANNELS, ACTIVE } from "../core/constants.ts";
import { rel } from "../core/format.ts";
import { tgText } from "../core/config.ts";
import { custOf, custName, whoText } from "../core/people.ts";
import { newId, writeFailed } from "../core/data.ts";
import { createTicket, nextIdNum, openTicket } from "../core/tickets.ts";
import { createCustomer, updateCustomer, callerMatches } from "../core/customers.ts";
import { similar } from "../core/similar.ts";
import { routeLine } from "../core/routing.ts";
import { lastResolution } from "../core/emails.ts";
import { useApp, Dialog, Icon, CatIcon, StatusChip, Options } from "../ui/index.tsx";
import type { Customer, Ticket } from "../core/types.ts";

const HINT = "Picking the caller fills in their company and site.";

/** fillSites(): the site preselected for a customer (its only site, if it has exactly one). */
function defaultSite(cid: string): string {
  const c = S.custById.get(cid), sites = c ? c.sites || [] : [];
  return sites.length === 1 ? sites[0].id : "";
}

/** simRow(t, cid, false) */
function SimRow({ t, cid }: { t: Ticket; cid: string }) {
  const res = lastResolution(t) || ((t.notes || []).filter((n) => n.text).slice(-1)[0] || ({} as any)).text || "";
  const c = custOf(t), dup = ACTIVE.has(t.status) && cid && c && c.id === cid;
  return (
    <div className="sim"><CatIcon c={t.category} />
      <div className="meta"><b>{t.subject}</b>
        <span>{t.id}, {custName(t)}, {rel(t.createdAt)}<StatusChip k={t.status} />{dup ? <span className="dup">Still open for this customer</span> : null}</span>
        {res ? <span className="res">{res.length > 180 ? res.slice(0, 180) + "…" : res}</span> : null}
      </div>
    </div>
  );
}

/** routeLine(cat), with the agent's name in bold as in the single-file edition. */
function RouteText({ text }: { text: string }) {
  const m = /^Will be auto-assigned to (.+), first available for (.+)$/.exec(text);
  if (m) return <span>Will be auto-assigned to <b>{m[1]}</b>, first available for {m[2]}</span>;
  return <span>{text}</span>;
}

export function NewTicketDialog({ customerId }: { customerId?: string }) {
  useApp();
  const cfg = S.cfg;
  const init = customerId && S.custById.has(customerId) ? customerId : "";
  const [subject, setSubject] = useState("");
  const [caller, setCaller] = useState("");
  const [popOpen, setPopOpen] = useState(false);
  const [hint, setHint] = useState(HINT);
  const [cust, setCust] = useState(init);
  const [site, setSite] = useState(() => defaultSite(init));
  const [contact, setContact] = useState("");
  const [newCust, setNewCust] = useState("");
  const [rname, setRname] = useState("");
  const [remail, setRemail] = useState("");
  const [rphone, setRphone] = useState("");
  const [sname, setSname] = useState("");
  const [saddr, setSaddr] = useState("");
  const [chan, setChan] = useState<string>(cfg.defaults.channel);
  const [sev, setSev] = useState<string>(cfg.defaults.severity);
  const [team, setTeam] = useState<string>((cfg.teams.includes(P.team) && P.team) || (cfg.teams.includes(cfg.defaults.team) && cfg.defaults.team) || cfg.teams[0]);
  const [category, setCategory] = useState<string>(cfg.categories[0]);
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sims, setSims] = useState<{ t: Ticket; sc: number }[]>([]);
  const [simKey, setSimKey] = useState(0);
  const focusNext = useRef<string | null>(null);

  const focus = (id: string) => { const el = document.getElementById(id) as HTMLElement | null; if (el) el.focus(); };

  // Focus the subject once the modal is showing (Dialog's effect runs first).
  useEffect(() => { focus("f-subject"); }, []);
  // Focus a field that has just been revealed.
  useEffect(() => { if (focusNext.current) { const id = focusNext.current; focusNext.current = null; focus(id); } });
  // Close the caller list on a click anywhere outside it.
  useEffect(() => {
    const h = (e: MouseEvent) => { const t = e.target as Element | null; if (!(t && t.closest && t.closest(".callerpick"))) setPopOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);
  // renderSimilar(): debounced 250 ms after the subject, details, customer or category change.
  useEffect(() => {
    if (!simKey) return;
    const tm = setTimeout(() => { setSims(similar(subject + " " + desc, { customerId: cust, category, limit: 4 })); }, 250);
    return () => clearTimeout(tm);
  }, [simKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const renderSimilar = () => setSimKey((k) => k + 1);

  const c = S.custById.get(cust) as Customer | undefined;
  const sites = c ? c.sites || [] : [];
  const contacts = c ? (c.contacts || []).slice().sort((a, b) => a.name.localeCompare(b.name)) : [];
  const custList = S.customers.slice().sort((a, b) => a.name.localeCompare(b.name));
  const matches = popOpen ? callerMatches(caller) : [];
  const route = routeLine(category);

  /* fillContacts() + fillSites() */
  const changeCust = (cid: string) => { setCust(cid); setContact(""); setSite(defaultSite(cid)); };

  const pickCaller = (cid: string, kid: string) => {
    const cc = S.custById.get(cid), k = cc && (cc.contacts || []).find((x) => x.id === kid);
    if (!cc || !k) return;
    let sid = defaultSite(cid);
    if (k.siteId && (cc.sites || []).some((x) => x.id === k.siteId)) sid = k.siteId;
    setCust(cid); setContact(kid); setSite(sid);
    setCaller(k.name); setPopOpen(false);
    const st = (cc.sites || []).find((x) => x.id === sid);
    setHint("Filled in " + cc.name + (st ? ", " + st.name : "") + " from " + k.name.split(/\s+/)[0] + "'s details.");
    renderSimilar();
  };
  const callerNew = () => {
    const nm = caller.trim();
    setPopOpen(false); setContact("__new"); setRname(nm);
    setHint(cust ? "Adding " + nm + " as a new contact." : "Choose their company below, and " + nm + " will be added as a new contact.");
    focusNext.current = cust ? "f-remail" : "f-cust";
  };

  async function submit() {
    setErr("");
    const f: any = { subject: subject.trim(), severity: sev, team, category, description: desc.trim(), channel: chan };
    let cid = cust, sid = site;
    const newName = newCust.trim(), kid = contact;
    const nc = { name: rname.trim(), email: remail.trim(), phone: rphone.trim() }, ns = { name: sname.trim(), address: saddr.trim() };
    if (sid === "__new" && !ns.name) { setErr("Add the new site's name."); focus("f-sname"); return; }
    if (!f.subject) { setErr("Add a subject so the ticket can be found in the queue."); focus("f-subject"); return; }
    if (!cid) { setErr("Choose the customer this ticket is for."); focus("f-cust"); return; }
    if (cid === "__new" && !newName) { setErr("Add the new customer's name."); focus("f-customer"); return; }
    if (kid === "__new" && !nc.name) { setErr("Add the new contact's name."); focus("f-rname"); return; }
    if (kid === "__new" && nc.email && !/^\S+@\S+\.\S+$/.test(nc.email)) { setErr("That email address doesn't look complete."); focus("f-remail"); return; }
    setBusy(true);
    try {
      if (cid === "__new") { const ex = S.custByName.get(newName.toLowerCase()); cid = ex ? ex.id : await createCustomer(newName); }
      let con: any = null, st: any = null;
      if (sid === "__new") {
        st = { id: newId("s"), name: ns.name.slice(0, 80), address: ns.address.slice(0, 300) };
        const ok = await updateCustomer(cid, (cc: Customer) => ({ changes: { sites: (cc.sites || []).concat([st]) }, event: { action: "updated", detail: "Site added: " + st.name } }));
        if (!ok) { setBusy(false); return; }
        sid = st.id;
      } else if (sid) {
        const c0 = S.custById.get(cid); st = (c0 && (c0.sites || []).find((x) => x.id === sid)) || null; if (!st) sid = "";
      }
      if (kid === "__new") {
        con = { id: "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: nc.name, email: nc.email, phone: nc.phone, role: "", siteId: sid || "" };
        const ok = await updateCustomer(cid, (cc: Customer) => ({ changes: { contacts: (cc.contacts || []).concat([con]) }, event: { action: "contact-added", detail: con.name } }));
        if (!ok) { setBusy(false); return; }
      } else if (kid) {
        const c0 = S.custById.get(cid); con = (c0 && (c0.contacts || []).find((k) => k.id === kid)) || null;
      }
      const cc = S.custById.get(cid);
      const id: string = await createTicket(Object.assign(f, {
        customerId: cid, customer: cc ? cc.name : newName, contactId: con ? con.id : null, siteId: sid || null, site: st ? st.name : "",
        requesterName: con ? con.name : "", requesterEmail: con ? con.email || "" : "", requesterPhone: con ? con.phone || "" : "",
      }));
      closeDialog();
      S.q.status = "active";
      if (!TICKET_VIEWS.includes(S.view)) S.view = "queue";
      openTicket(id);
      const nt = S.byId.get(id);
      toast("Ticket " + id + " created" + (nt && (nt.assigneeId || nt.assigneeLabel) ? " and auto-assigned to " + whoText(nt.assigneeId, nt.assigneeLabel) : "") + ". I'm on it.", "happy");
    } catch (e) { writeFailed(e); }
    setBusy(false);
  }

  return (
    <Dialog id="dlg" labelledBy="dlg-h" onClose={closeDialog}>
      <div className="d-top"><span className="lbl" id="f-idlbl">{"New ticket" + (c && c.idPrefix ? ", will be " + c.idPrefix + nextIdNum(c) : "")}</span>
        <button className="x" data-act="dlg-close" aria-label="Close" onClick={closeDialog}><Icon name="x" /></button>
      </div>
      <h2 id="dlg-h">What's gone wrong?</h2>
      <p className="muted">The resolution target comes from the severity and the customer's support plan.</p>
      <div className="form">
        <label className="full"><span className="lbl">Subject</span>
          <input className="field" id="f-subject" maxLength={160} autoComplete="off" value={subject} onChange={(e) => { setSubject(e.target.value); renderSimilar(); }} />
        </label>
        <div className="full callerpick">
          <label><span className="lbl">Caller</span>
            <input className="field" id="f-caller" placeholder="Start typing a name, email or phone number" autoComplete="off" aria-describedby="f-caller-hint" style={{ width: "100%" }}
              value={caller} onChange={(e) => { setCaller(e.target.value); setPopOpen(e.target.value.trim().length >= 2); }} />
          </label>
          <div className="pop" id="f-caller-pop" hidden={!popOpen}>
            {popOpen ? <>
              {matches.map(({ c: mc, k }: any) => {
                const st = (mc.sites || []).find((x: any) => x.id === k.siteId);
                return (
                  <button key={mc.id + "/" + k.id} className="opt" data-act="caller-pick" data-c={mc.id} data-k={k.id} onClick={() => pickCaller(mc.id, k.id)}>
                    <b>{k.name}</b><span>{mc.name + (st ? ", " + st.name : "") + (k.email ? ", " + k.email : "")}</span>
                  </button>
                );
              })}
              <button className="opt" data-act="caller-new" onClick={callerNew}><b>{matches.length ? "Someone else" : "No match"}</b><span>Add {caller.trim()} as a new contact</span></button>
            </> : null}
          </div>
          <span className="muted" id="f-caller-hint" style={{ fontSize: 12.5, display: "block", marginTop: 4 }}>{hint}</span>
        </div>
        <label><span className="lbl">Customer</span>
          <select className="field" id="f-cust" value={cust} onChange={(e) => { changeCust(e.target.value); renderSimilar(); }}>
            <option value="">Choose a customer</option>
            {custList.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            <option value="__new">New customer</option>
          </select>
        </label>
        <label><span className="lbl">Site</span>
          <select className="field" id="f-site" value={site} onChange={(e) => { setSite(e.target.value); if (e.target.value === "__new") focusNext.current = "f-sname"; }}>
            <option value="">No site</option>
            {sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            <option value="__new">New site</option>
          </select>
        </label>
        <label><span className="lbl">Contact</span>
          <select className="field" id="f-contact" value={contact} onChange={(e) => {
            const v = e.target.value; setContact(v);
            const k = c && (c.contacts || []).find((x) => x.id === v);
            if (k && k.siteId && (c!.sites || []).some((x) => x.id === k.siteId)) setSite(k.siteId);
          }}>
            <option value="">No specific contact</option>
            {contacts.map((k) => <option key={k.id} value={k.id}>{k.name + (k.role ? ", " + k.role : "")}</option>)}
            <option value="__new">New contact</option>
          </select>
        </label>
        <label className="full" id="f-newcust-w" hidden={cust !== "__new"}><span className="lbl">New customer name</span>
          <input className="field" id="f-customer" maxLength={80} autoComplete="off" value={newCust} onChange={(e) => setNewCust(e.target.value)} />
        </label>
        <div className="full subform" id="f-newcon" hidden={contact !== "__new"} style={{ marginTop: 0 }}>
          <label className="full"><span className="lbl">Contact name</span><input className="field" id="f-rname" maxLength={80} autoComplete="off" value={rname} onChange={(e) => setRname(e.target.value)} /></label>
          <label><span className="lbl">Email</span><input className="field" id="f-remail" type="email" maxLength={120} autoComplete="off" value={remail} onChange={(e) => setRemail(e.target.value)} /></label>
          <label><span className="lbl">Phone</span><input className="field" id="f-rphone" maxLength={40} autoComplete="off" value={rphone} onChange={(e) => setRphone(e.target.value)} /></label>
        </div>
        <div className="full subform" id="f-newsite" hidden={site !== "__new"} style={{ marginTop: 0 }}>
          <label className="full"><span className="lbl">Site name</span><input className="field" id="f-sname" maxLength={80} autoComplete="off" value={sname} onChange={(e) => setSname(e.target.value)} /></label>
          <label className="full"><span className="lbl">Address</span><input className="field" id="f-saddr" maxLength={300} autoComplete="off" value={saddr} onChange={(e) => setSaddr(e.target.value)} /></label>
        </div>
        <label><span className="lbl">Channel</span>
          <select className="field" id="f-chan" value={chan} onChange={(e) => setChan(e.target.value)}><Options list={Object.keys(CHANNELS)} label={(k) => (CHANNELS as any)[k]} /></select>
        </label>
        <label><span className="lbl">Severity</span>
          <select className="field" id="f-sev" value={sev} onChange={(e) => setSev(e.target.value)}><Options list={Object.keys(SEV)} label={(o) => o + " " + (SEV as any)[o].label + ", " + tgText((cfg.targets as any)[o])} /></select>
        </label>
        <label><span className="lbl">Team</span>
          <select className="field" id="f-team" value={team} onChange={(e) => setTeam(e.target.value)}><Options list={cfg.teams} /></select>
        </label>
        <label><span className="lbl">Category</span>
          <select className="field" id="f-category" value={category} onChange={(e) => { setCategory(e.target.value); renderSimilar(); }}><Options list={cfg.categories} /></select>
        </label>
        <div className="full routeline" id="f-route">{route ? <><Icon name="user" /><RouteText text={route.text} /></> : null}</div>
        <label className="full"><span className="lbl">Details</span>
          <textarea className="field" id="f-desc" rows={5} maxLength={8000} placeholder="Symptoms, affected users or systems, what has been tried" value={desc} onChange={(e) => { setDesc(e.target.value); renderSimilar(); }} />
        </label>
        <div className="full" id="f-similar" aria-live="polite">
          {sims.length ? (
            <div className="simbox"><span className="lbl" style={{ display: "block", marginBottom: 4 }}>Similar past tickets</span>
              {sims.map((x) => <SimRow key={x.t.id} t={x.t} cid={cust} />)}
            </div>
          ) : null}
        </div>
        <div className="full err" id="f-err" role="alert">{err}</div>
        <div className="full actions">
          <button className="btn" data-act="dlg-close" onClick={closeDialog}>Cancel</button>
          <button className="btn primary" data-act="create" disabled={busy} onClick={submit}>Create ticket</button>
        </div>
      </div>
    </Dialog>
  );
}
