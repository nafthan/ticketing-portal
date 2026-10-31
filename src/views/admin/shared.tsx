/*
 * Small helpers shared by the Admin tabs, Reports and Audit.
 * (Local to these views; not part of src/core.)
 */
import { useState } from "react";
import { S, commit, setView } from "../../core/state.ts";
import { resetFilters } from "../../core/queue.ts";
import { openTicket } from "../../core/tickets.ts";

/** Focus an element by id, as the single-file edition did after a validation error. */
export function focusId(id: string): void {
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  if (el) (el as HTMLElement).focus();
}

/**
 * Form values keyed by element id, rebuilt from the store whenever `sig`
 * changes (like adminSwap): the field being typed in keeps its value.
 */
export function useForm<T extends Record<string, any>>(sig: string, build: () => T): [T, (id: string, v: any) => void, (patch: Partial<T>) => void] {
  const [st, setSt] = useState(() => ({ sig, v: build() }));
  let cur = st;
  if (st.sig !== sig) {
    const fresh: any = build();
    const ae: any = typeof document !== "undefined" ? document.activeElement : null;
    if (ae && ae.id && ae.id in fresh && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && !/^(checkbox|file)$/.test(ae.type)) fresh[ae.id] = st.v[ae.id];
    cur = { sig, v: fresh };
    setSt(cur);
  }
  const set = (id: string, v: any) => setSt((s) => ({ sig: s.sig, v: { ...s.v, [id]: v } }));
  const patch = (p: Partial<T>) => setSt((s) => ({ sig: s.sig, v: { ...s.v, ...p } }));
  return [cur.v, set, patch];
}

/** data-act="goto": open a ticket in the queue with every filter cleared. */
export function gotoTicket(id: string): void {
  S.view = "queue";
  resetFilters();
  S.q.status = "all";
  openTicket(id);
  commit();
  if (typeof window !== "undefined") window.scrollTo(0, 0);
}

/** data-act="cust-goto": open a customer by id, or search for it by name. */
export function gotoCustomer(cid: string, name: string): void {
  const c = S.custById.get(cid || "") || S.custByName.get(String(name || "").toLowerCase());
  S.view = "customers";
  S.selCust = c ? c.id : null;
  if (!c) S.cuText = name || "";
  commit();
  if (typeof window !== "undefined") window.scrollTo(0, 0);
}

/** data-act="drill": show these tickets in the queue. */
export function drill(k: string, val: string): void {
  resetFilters();
  S.q.status = "all";
  if (k === "status") S.q.status = val; else (S.q as any)[k] = val;
  S.sel = null;
  setView("queue");
}

/** The on/off switch rows used on the Rules and Auto-assign tabs. */
export function Switch({ id, on, title, desc, onChange }: { id: string; on: boolean; title: string; desc: string; onChange: (v: boolean) => void }) {
  return (
    <label className="switch"><span><b style={{ fontWeight: 500 }}>{title}</b><br /><span className="muted" style={{ fontSize: 13 }}>{desc}</span></span>
      <input type="checkbox" id={id} checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
