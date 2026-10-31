import { useState } from "react";
import { S } from "../../core/state.ts";
import { ROUTE_LABEL } from "../../core/constants.ts";
import { slug } from "../../core/format.ts";
import { mTeams, staffByKey, staffKey, staffName, staffSorted } from "../../core/people.ts";
import { routeOrder, routePick, routeState, saveRouting, editOrder } from "../../core/routing.ts";
import { useApp, CatIcon, Icon, Person } from "../../ui/index.tsx";
import { focusId, Switch } from "./shared.tsx";

/** adRouting(): auto-assign switches and an order of agents per category. */
export function Routing() {
  useApp();
  const R = S.cfg.routing, cats = S.cfg.categories;
  const [pick, setPick] = useState<Record<string, string>>({});

  const card = (cat: string) => {
    const ord = routeOrder(cat), nx = routePick({ category: cat, history: [] } as any), inOrd = new Set(ord);
    const selId = "rt-add-" + slug(cat), sel = pick[cat] || "";
    const add = () => {
      if (!sel) { focusId(selId); return; }
      setPick({ ...pick, [cat]: "" });
      editOrder(cat, (l) => { if (!l.includes(sel)) l.push(sel); });
    };
    return (
      <div className="card rtcard" key={cat}>
        <div className="th"><CatIcon c={cat} /><b>{cat}</b></div>
        <div className="next">{!ord.length ? "No order set, so new tickets wait in Unassigned." : nx ? <>Next in line: <b>{staffName(nx)}</b></> : "Nobody in this order is available right now."}</div>
        {ord.map((key: string, i: number) => {
          const m = staffByKey(key), st = routeState(m), L = (ROUTE_LABEL as any)[st];
          return (
            <div className="lrow" key={key + i}>
              <span className="rank num">{i + 1}</span>
              <span className="nm">{m ? <Person uid={m.uid} label={m.label} size={24} /> : <span className="muted">{key.slice(2)}</span>}</span>
              <span className={"pill " + L[0]}>{L[1]}</span>
              <button className="mvb" data-act="rt-mv" data-c={cat} data-i={i} data-d="-1" disabled={i === 0} aria-label="Move up"
                onClick={() => editOrder(cat, (l) => { const j = i - 1; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; })}><Icon name="aup" /></button>
              <button className="mvb" data-act="rt-mv" data-c={cat} data-i={i} data-d="1" disabled={i === ord.length - 1} aria-label="Move down"
                onClick={() => editOrder(cat, (l) => { const j = i + 1; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; })}><Icon name="adn" /></button>
              <button className="x" data-act="rt-rm" data-c={cat} data-i={i} aria-label={"Remove from " + cat}
                onClick={() => editOrder(cat, (l) => { l.splice(i, 1); })}><Icon name="x" /></button>
            </div>
          );
        })}
        {S.staff.some((m) => !inOrd.has(staffKey(m)))
          ? <div className="addrow">
              <select className="field" id={selId} aria-label={"Add an agent to the " + cat + " order"} value={sel} onChange={(e) => setPick({ ...pick, [cat]: e.target.value })}>
                <option value="">Add an agent</option>
                {staffSorted().filter((m) => !inOrd.has(staffKey(m))).map((m) => (
                  <option key={m.id} value={staffKey(m)}>{staffName(m) + (mTeams(m).length ? " (" + mTeams(m).join(", ") + ")" : "")}</option>
                ))}
              </select>
              <button className="btn dark" data-act="rt-add" data-c={cat} onClick={add}>Add</button>
            </div>
          : null}
      </div>
    );
  };

  return (
    <>
      <div className="card adcard" style={{ marginBottom: 20, maxWidth: 820 }}><h3>Auto-assign</h3>
        <p className="muted">Each category has an order of preferred agents. A new ticket goes to the first person in its category's order who is clocked in, available and under their ticket limit. Anyone who hands a ticket back is skipped for that ticket.</p>
        <Switch id="rt-on" on={!!R.on} title="Assign new tickets automatically" desc="Off means every new ticket waits in Unassigned." onChange={(v) => saveRouting(null, { on: v })} />
        <Switch id="rt-retry" on={!!R.retry} title="Keep trying for waiting tickets" desc="When nobody in the order is free, assign the ticket as soon as someone is, for example when they clock in." onChange={(v) => saveRouting(null, { retry: v })} />
      </div>
      {S.staff.length ? null : <div className="note"><span>Add agents under Admin, Agents first, then set the order for each category here.</span></div>}
      <div className="rtgrid">{cats.map(card)}</div>
    </>
  );
}
