/* The Customers tab: renderCustomers and the #v-customers markup in the single-file edition. */
import { useEffect, useState, type ReactNode } from "react";
import { S, commit } from "../core/state.ts";
import { ACTIVE } from "../core/constants.ts";
import { fmtMin, plural } from "../core/format.ts";
import { sla } from "../core/hours.ts";
import { custOf, custName } from "../core/people.ts";
import { writeFailed } from "../core/data.ts";
import { createCustomer } from "../core/customers.ts";
import { useApp, Logo, Tier } from "../ui/index.tsx";
import type { Customer } from "../core/types.ts";

/** Focus (and optionally select) an element once React has rendered it. */
function focusWhenReady(id: string, select?: boolean, tries = 30): void {
  const el = typeof document !== "undefined" ? (document.getElementById(id) as HTMLInputElement | null) : null;
  if (el) { el.focus(); if (select) el.select(); return; }
  if (tries > 0 && typeof requestAnimationFrame !== "undefined") requestAnimationFrame(() => focusWhenReady(id, select, tries - 1));
}

export function Customers() {
  useApp();
  const [text, setText] = useState(S.cuText);
  // S.cuText can be set from elsewhere (a customer link with no record); keep the box in step.
  useEffect(() => { if (S.cuText !== text.trim()) setText(S.cuText); }, [S.cuText]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = S.cuText.toLowerCase(), since = Date.now() - 30 * 864e5;
  const stats = new Map<string, { act: number; n: number; br: number; min: number; name: string }>();
  for (const t of S.tickets) {
    const c = custOf(t), k = c ? c.id : "n:" + custName(t).toLowerCase();
    let s = stats.get(k);
    if (!s) { s = { act: 0, n: 0, br: 0, min: 0, name: custName(t) }; stats.set(k, s); }
    s.n++;
    if (ACTIVE.has(t.status)) { s.act++; if (sla(t).over) s.br++; }
    for (const n of t.notes || []) if ((n.minutes as number) > 0 && new Date(n.at).getTime() >= since) s.min += n.minutes as number;
  }
  const match = (name: string, c: Customer | null) => !q || name.toLowerCase().includes(q) ||
    !!(c && (c.contacts || []).some((k) => [k.name, k.email, k.phone].join(" ").toLowerCase().includes(q)));
  const z = { act: 0, n: 0, br: 0, min: 0, name: "" };

  const open = (cid: string) => { S.selCust = cid; commit(); };
  const addNew = () => {
    createCustomer("New customer").then((id: string) => { S.selCust = id; commit(); focusWhenReady("cf-name", true); }).catch(writeFailed);
  };
  const adopt = (name: string) => {
    createCustomer(name).then((id: string) => { S.selCust = id; commit(); }).catch(writeFailed);
  };

  const cards: ReactNode[] = S.customers.filter((c) => match(c.name, c))
    .sort((a, b) => (stats.get(b.id) || z).act - (stats.get(a.id) || z).act || a.name.localeCompare(b.name))
    .map((c) => {
      const s = stats.get(c.id) || z;
      return (
        <button key={c.id} className="cust" data-act="cust-open" data-cid={c.id} aria-selected={S.selCust === c.id ? "true" : "false"} onClick={() => open(c.id)}>
          <span className="top"><Logo c={c} name={c.name} size={40} /><b>{c.name}</b>{c.idPrefix ? <span className="tid" title="Ticket ID prefix">{c.idPrefix}</span> : null}<Tier c={c} /></span>
          <span className="stats">
            <span><b>{s.act}</b> active</span>
            {s.br ? <span className="breach"><b style={{ color: "inherit" }}>{s.br}</b> past target</span> : null}
            <span><b>{(c.contacts || []).length}</b> contacts</span>
            <span><b>{fmtMin(s.min)}</b> in 30 days</span>
          </span>
          {c.allHours ? <span className="pill oncall" style={{ alignSelf: "flex-start" }}>24/7 support</span> : null}
        </button>
      );
    });
  const orphans: ReactNode[] = [...stats.entries()].filter(([k, s]) => k.startsWith("n:") && s.name && match(s.name, null)).map(([k, s]) => (
    <div key={k} className="cust" style={{ cursor: "default", borderStyle: "dashed" }}>
      <span className="top"><Logo c={null} name={s.name} size={40} /><b>{s.name}</b></span>
      <span className="stats"><span><b>{s.act}</b> active</span><span><b>{s.n}</b> tickets</span></span>
      {S.canWrite
        ? <button className="btn" style={{ alignSelf: "flex-start" }} data-act="cust-adopt" data-name={s.name} onClick={() => adopt(s.name)}>Create customer record</button>
        : <span className="muted">No customer record yet</span>}
    </div>
  ));
  const all = cards.concat(orphans);

  return (
    <>
      <div className="pagehead">
        <div><h1>Customers</h1><p id="cu-sub">{S.customers.length ? plural(S.customers.length, "customer") + ". Select one to edit its contacts, priority and SLA targets." : "No customer records yet."}</p></div>
        <div className="toolbar" style={{ margin: 0 }}>
          <div className="searchbox" id="cu-sb">
            <input className="field" id="cu-text" type="search" placeholder="Search customers and contacts" aria-label="Search customers"
              value={text} onChange={(e) => { setText(e.target.value); S.cuText = e.target.value.trim(); commit(); }} />
          </div>
          <button className="btn dark" data-act="cust-new" id="cu-new" hidden={!S.canWrite} onClick={addNew}>Add customer</button>
        </div>
      </div>
      <div className="custgrid" id="cu-body">
        {all.length ? all : (
          <div className="card empty" style={{ gridColumn: "1/-1" }}>
            <b>{q ? "No customers match" : "No customers yet"}</b>{q ? "Try a different name or contact." : "Add a customer, or create one while logging a ticket."}
          </div>
        )}
      </div>
    </>
  );
}
