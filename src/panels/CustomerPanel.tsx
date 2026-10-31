/* The customer side panel: renderCustPanel and its handlers in the single-file edition. */
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { S, svc, commit, openDialog } from "../core/state.ts";
import { ACTIVE, SEV, ST_LABEL, TIERS } from "../core/constants.ts";
import { fmtMin, plural } from "../core/format.ts";
import { custOf } from "../core/people.ts";
import { nextIdNum, openTicket } from "../core/tickets.ts";
import { prio } from "../core/queues.ts";
import { resetFilters } from "../core/queue.ts";
import { custField, custSla, saveContact, removeContact, saveSite, removeSite, uploadLogo, removeLogo } from "../core/customers.ts";
import { useApp, Icon, Logo, Ava, CatIcon, Sev, Options } from "../ui/index.tsx";
import type { Customer, Ticket } from "../core/types.ts";

type ConF = { name: string; role: string; email: string; phone: string; site: string };
type SiteF = { name: string; address: string };

/**
 * A field that saves on the native "change" event (blur or Enter), like the
 * single-file edition's data-cf / data-cs inputs. It shows the stored value,
 * and goes back to it after a save, unless you're typing in it right now.
 */
function useStored(src: string, save: (v: string) => unknown) {
  const ref = useRef<any>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const [value, setValue] = useState(src);
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const el = ref.current, ae = typeof document !== "undefined" ? document.activeElement : null;
    if (el && ae === el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
    setValue(src);
  }, [src, rev]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = () => { const bump = () => setRev((r) => r + 1); Promise.resolve(saveRef.current(el.value)).then(bump, bump); };
    el.addEventListener("change", h);
    return () => el.removeEventListener("change", h);
  }, []);
  return { ref, value, onChange: (e: any) => setValue(e.target.value) };
}

export function CustomerPanel({ id }: { id: string }) {
  useApp();
  // Keyed by customer so open forms and confirmations don't carry over to another customer.
  return <Panel key={id} id={id} />;
}

function Panel({ id }: { id: string }) {
  useApp();
  const c = S.custById.get(id) as Customer | undefined;
  const [conForm, setConForm] = useState<{ id: string; f: ConF } | null>(null);
  const [siteForm, setSiteForm] = useState<{ id: string; f: SiteF } | null>(null);
  const [rmContact, setRmContact] = useState<string | null>(null);
  const [rmSite, setRmSite] = useState<string | null>(null);
  const [cnErr, setCnErr] = useState("");
  const [sfErr, setSfErr] = useState("");
  const topRef = useRef<HTMLDivElement>(null);

  // A different customer starts at the top of the panel.
  useLayoutEffect(() => { const d = topRef.current && topRef.current.closest(".detail"); if (d) d.scrollTop = 0; }, []);

  const cf = (k: string) => (v: string) => custField(k, v);
  const nameF = useStored(c ? c.name : "", cf("name"));
  const priF = useStored(c ? c.priority || "N" : "N", cf("priority"));
  const hrsF = useStored(c && c.allHours ? "1" : "", cf("allHours"));
  const preF = useStored(c ? c.idPrefix || "" : "", cf("idPrefix"));
  const startF = useStored(c && c.idPrefix ? String(nextIdNum(c)) : "", cf("idStart"));
  const notesF = useStored(c ? c.notes || "" : "", cf("notes"));
  const slaVal = (k: string) => (c && c.sla && (c.sla as any)[k] ? String((c.sla as any)[k]) : "");
  const slaF: Record<string, ReturnType<typeof useStored>> = {
    S1: useStored(slaVal("S1"), (v) => custSla("S1", v)),
    S2: useStored(slaVal("S2"), (v) => custSla("S2", v)),
    S3: useStored(slaVal("S3"), (v) => custSla("S3", v)),
    S4: useStored(slaVal("S4"), (v) => custSla("S4", v)),
  };

  if (!c) return null;

  const tickets = S.tickets.filter((t) => custOf(t) === c);
  const ro = !S.canWrite, cons = c.contacts || [];
  const act = tickets.filter((t) => ACTIVE.has(t.status)).sort(prio);
  const recent = tickets.filter((t) => !ACTIVE.has(t.status)).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 5);
  const since = Date.now() - 30 * 864e5;
  let m30 = 0, b30 = 0;
  for (const t of tickets) for (const n of t.notes || []) if ((n.minutes as number) > 0 && new Date(n.at).getTime() >= since) { m30 += n.minutes as number; if (n.billable) b30 += n.minutes as number; }
  const sites = c.sites || [];

  const goto = (tid: string) => { S.view = "queue"; resetFilters(); S.q.status = "all"; openTicket(tid); window.scrollTo(0, 0); };
  const tline = (t: Ticket) => (
    <button key={t.id} className="tline" data-act="goto" data-id={t.id} onClick={() => goto(t.id)}>
      <CatIcon c={t.category} /><span className="meta"><b>{t.subject}</b><span>{t.id}, {(ST_LABEL as any)[t.status]}</span></span><Sev k={t.severity} />
    </button>
  );

  /* contacts */
  const onSaveContact = () => {
    if (!conForm) return;
    const f = conForm.f;
    const v = { name: (f.name || "").trim(), role: (f.role || "").trim(), email: (f.email || "").trim(), phone: (f.phone || "").trim(), site: sites.some((x) => x.id === f.site) ? f.site : "" };
    if (!v.name) { setCnErr("Add the contact's name."); return; }
    if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) { setCnErr("That email address doesn't look complete."); return; }
    const r = saveContact(conForm.id, v);
    if (typeof r === "string" && r) { setCnErr(r); return; }
    setConForm(null); setCnErr("");
  };
  const setCon = (k: keyof ConF) => (e: any) => { const val = e.target.value; setConForm((p) => (p ? { id: p.id, f: { ...p.f, [k]: val } } : p)); };
  const conFormEl = conForm ? (
    <div className="subform" key={"cf-" + conForm.id}>
      <label><span className="lbl">Name</span><input className="field" id="cn-name" maxLength={80} autoComplete="off" autoFocus={conForm.id === "new"} value={conForm.f.name} onChange={setCon("name")} /></label>
      <label><span className="lbl">Role</span><input className="field" id="cn-role" maxLength={60} autoComplete="off" value={conForm.f.role} onChange={setCon("role")} /></label>
      <label><span className="lbl">Email</span><input className="field" id="cn-email" type="email" maxLength={120} autoComplete="off" value={conForm.f.email} onChange={setCon("email")} /></label>
      <label><span className="lbl">Phone</span><input className="field" id="cn-phone" maxLength={40} autoComplete="off" value={conForm.f.phone} onChange={setCon("phone")} /></label>
      <label className="full"><span className="lbl">Site</span>
        <select className="field" id="cn-site" value={conForm.f.site} onChange={setCon("site")}>
          <option value="">No site</option>
          {sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      <div className="full" id="cn-err" style={{ color: "var(--warn)", fontSize: 12.5, fontWeight: 500 }}>{cnErr}</div>
      <div className="full actions">
        <button className="btn" data-act="con-cancel" onClick={() => { setConForm(null); setCnErr(""); }}>Cancel</button>
        <button className="btn dark" data-act="con-save" onClick={onSaveContact}>Save contact</button>
      </div>
    </div>
  ) : null;

  /* sites */
  const onSaveSite = () => {
    if (!siteForm) return;
    const v = { name: (siteForm.f.name || "").trim().slice(0, 80), address: (siteForm.f.address || "").trim().slice(0, 300) };
    if (!v.name) { setSfErr("Give the site a name, like Head office or the town it's in."); return; }
    const r = saveSite(siteForm.id, v);
    if (typeof r === "string" && r) { setSfErr(r); return; }
    setSiteForm(null); setSfErr("");
  };
  const setSf = (k: keyof SiteF) => (e: any) => { const val = e.target.value; setSiteForm((p) => (p ? { id: p.id, f: { ...p.f, [k]: val } } : p)); };
  const siteFormEl = siteForm ? (
    <div className="subform" key={"sf-" + siteForm.id}>
      <label className="full"><span className="lbl">Site name</span><input className="field" id="sf-name" maxLength={80} placeholder="e.g. Rugeley warehouse" autoComplete="off" autoFocus={siteForm.id === "new"} value={siteForm.f.name} onChange={setSf("name")} /></label>
      <label className="full"><span className="lbl">Address</span><textarea className="field" id="sf-address" rows={2} maxLength={300} value={siteForm.f.address} onChange={setSf("address")} /></label>
      <div className="full" id="sf-err" style={{ color: "var(--warn)", fontSize: 12.5, fontWeight: 500 }}>{sfErr}</div>
      <div className="full actions">
        <button className="btn" data-act="site-cancel" onClick={() => { setSiteForm(null); setSfErr(""); }}>Cancel</button>
        <button className="btn dark" data-act="site-save" onClick={onSaveSite}>Save site</button>
      </div>
    </div>
  ) : null;

  const brLines = (parts: string[]) => parts.map((p, i) => <Fragment key={i}>{i ? <br /> : null}{p}</Fragment>);

  return (
    <>
      <div className="d-top" ref={topRef}>
        <Logo c={c} name={c.name} size={36} /><span className="lbl">Customer{c.sample ? " / sample" : ""}</span>
        <button className="x" data-act="cust-close" aria-label="Close customer" onClick={() => { S.selCust = null; commit(); }}><Icon name="x" /></button>
      </div>
      <h2>{c.name}</h2>
      <p className="muted">{act.length} active, {plural(tickets.length, "ticket")} in total. {fmtMin(m30)} logged in the last 30 days, {fmtMin(b30)} of it billable.</p>
      {S.canWrite ? <div className="actions" style={{ marginTop: 14 }}><button className="btn primary" data-act="cust-ticket" onClick={() => openDialog({ kind: "newTicket", customerId: c.id })}>New ticket</button></div> : null}

      <div className="sect"><span className="lbl">Account</span>
        <div className="props" style={{ margin: 0 }}>
          <label style={{ gridColumn: "1/-1" }}><span className="lbl">Name</span><input className="field" id="cf-name" data-cf="name" maxLength={80} autoComplete="off" disabled={ro} {...nameF} /></label>
          <label><span className="lbl">Customer priority</span>
            <select className="field" id="cf-pri" data-cf="priority" disabled={ro} {...priF}><Options list={Object.keys(TIERS)} label={(k) => k + ", " + (TIERS as any)[k]} /></select>
          </label>
          <label><span className="lbl">Support hours</span>
            <select className="field" id="cf-hrs" data-cf="allHours" disabled={ro} {...hrsF}><option value="">Working hours</option><option value="1">Around the clock (24/7)</option></select>
          </label>
          <label><span className="lbl">Ticket ID prefix</span><input className="field" id="cf-pre" data-cf="idPrefix" maxLength={6} placeholder="e.g. FAI" autoComplete="off" style={{ textTransform: "uppercase" }} disabled={ro} {...preF} /></label>
          <label><span className="lbl">Next ticket number</span><input className="field" id="cf-start" data-cf="idStart" inputMode="numeric" maxLength={7} autoComplete="off" disabled={!c.idPrefix || ro} {...startF} /></label>
          <p className="muted" style={{ gridColumn: "1/-1", fontSize: 12.5, marginTop: -6 }}>
            {c.idPrefix
              ? <>New tickets for this customer are numbered <b className="tid">{c.idPrefix + nextIdNum(c)}</b>, <b className="tid">{c.idPrefix + (nextIdNum(c) + 1)}</b> and so on. Existing tickets keep their IDs.</>
              : "Leave blank to use the workspace prefix (" + S.cfg.idPrefix + "-…). Set one, like FAI, to number this customer's tickets FAI1, FAI2 and so on."}
          </p>
          <div style={{ gridColumn: "1/-1" }}><span className="lbl" style={{ display: "block", marginBottom: 6 }}>Resolution targets in hours</span>
            <div className="slagrid">
              {Object.keys(SEV).map((k) => (
                <label key={k}><span className="lbl">{k}</span><input className="field" id={"cs-" + k} inputMode="decimal" data-cs={k} placeholder={String((S.cfg.targets as any)[k].hours)} disabled={ro} {...slaF[k]} /></label>
              ))}
            </div>
            <span className="muted" style={{ fontSize: 12.5 }}>Leave blank to use the workspace default shown in grey.</span>
          </div>
          {svc.assets && S.canWrite ? (
            <div style={{ gridColumn: "1/-1", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="lbl" style={{ flex: 1 }}>Logo</span>
              <label className="btn" style={{ cursor: "pointer" }}><Icon name="up" />{c.logoId ? "Replace logo" : "Upload logo"}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-act-file="logo" hidden
                  onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; uploadLogo(f as File); }} />
              </label>
              {c.logoId ? <button className="btn" data-act="logo-rm" onClick={() => removeLogo()}>Remove</button> : null}
            </div>
          ) : null}
          <label style={{ gridColumn: "1/-1" }}><span className="lbl">Account notes</span><textarea className="field" id="cf-notes" data-cf="notes" rows={3} maxLength={4000} placeholder="Sites, escalation contacts, contract details" disabled={ro} {...notesF} /></label>
        </div>
      </div>

      <div className="sect"><span className="lbl">Sites ({sites.length})</span>
        {sites.map((x) => siteForm && siteForm.id === x.id ? siteFormEl : (
          <div className="crow" key={x.id}>
            <span className="cat" style={{ "--c": "var(--muted)" } as any}><Icon name="pin" /></span>
            <div className="meta"><b>{x.name}</b><span>{x.address ? <>{x.address.replace(/\n/g, ", ")}<br /></> : null}{plural(cons.filter((k) => k.siteId === x.id).length, "contact")}</span></div>
            {S.canWrite ? (rmSite === x.id
              ? <><button className="btn dark" data-act="site-rm-yes" data-s={x.id} onClick={() => { setRmSite(null); removeSite(x.id); }}>Remove</button><button className="btn" data-act="site-rm-no" onClick={() => setRmSite(null)}>Keep</button></>
              : <><button className="btn" data-act="site-edit" data-s={x.id} onClick={() => { setSfErr(""); setSiteForm({ id: x.id, f: { name: x.name, address: x.address || "" } }); }}>Edit</button><button className="btn" data-act="site-rm" data-s={x.id} aria-label={"Remove " + x.name} onClick={() => setRmSite(x.id)}><Icon name="x" /></button></>
            ) : null}
          </div>
        ))}
        {siteForm && siteForm.id === "new" ? siteFormEl
          : S.canWrite ? <button className="btn" style={{ marginTop: 8 }} data-act="site-new" onClick={() => { setSfErr(""); setSiteForm({ id: "new", f: { name: "", address: "" } }); }}><Icon name="plus" />Add site</button>
          : (sites.length ? null : <p className="muted">No sites yet.</p>)}
      </div>

      <div className="sect"><span className="lbl">Contacts ({cons.length})</span>
        {cons.map((k) => conForm && conForm.id === k.id ? conFormEl : (
          <div className="crow" key={k.id}>
            <Ava uid={null} label={k.name} size={32} />
            <div className="meta"><b>{k.name}{k.role ? <span className="muted" style={{ fontWeight: 400 }}>, {k.role}</span> : null}</b>
              <span>{brLines([(sites.find((x) => x.id === k.siteId) || ({} as any)).name, k.email, k.phone].filter(Boolean) as string[])}</span></div>
            {S.canWrite ? (rmContact === k.id
              ? <><button className="btn dark" data-act="con-rm-yes" data-k={k.id} onClick={() => { setRmContact(null); removeContact(k.id); }}>Remove</button><button className="btn" data-act="con-rm-no" onClick={() => setRmContact(null)}>Keep</button></>
              : <><button className="btn" data-act="con-edit" data-k={k.id} onClick={() => { setCnErr(""); setConForm({ id: k.id, f: { name: k.name, role: k.role || "", email: k.email || "", phone: k.phone || "", site: k.siteId || "" } }); }}>Edit</button><button className="btn" data-act="con-rm" data-k={k.id} aria-label={"Remove " + k.name} onClick={() => setRmContact(k.id)}><Icon name="x" /></button></>
            ) : null}
          </div>
        ))}
        {conForm && conForm.id === "new" ? conFormEl
          : S.canWrite ? <button className="btn" style={{ marginTop: 8 }} data-act="con-new" onClick={() => { setCnErr(""); setConForm({ id: "new", f: { name: "", role: "", email: "", phone: "", site: "" } }); }}><Icon name="plus" />Add contact</button>
          : (cons.length ? null : <p className="muted">No contacts yet.</p>)}
      </div>

      <div className="sect"><span className="lbl">Active tickets ({act.length})</span>
        {act.length ? act.map(tline) : <p className="muted">None right now.</p>}
        {recent.length ? <><span className="lbl" style={{ display: "block", margin: "16px 0 4px" }}>Recently finished</span>{recent.map(tline)}</> : null}
      </div>
    </>
  );
}
