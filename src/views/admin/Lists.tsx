import { useState } from "react";
import { S, toast } from "../../core/state.ts";
import { ACTIVE } from "../../core/constants.ts";
import { plural } from "../../core/format.ts";
import { saveCfg } from "../../core/config.ts";
import { useApp, CatIcon, Icon } from "../../ui/index.tsx";
import { focusId } from "./shared.tsx";

/** adLists(): the categories list. */
export function Lists() {
  useApp();
  const k = "categories";
  const cnt = (v: string) => S.tickets.filter((t) => ACTIVE.has(t.status) && t.category === v).length;
  const [rm, setRm] = useState<string | null>(null);
  const [add, setAdd] = useState("");

  function addOne() {
    const v = add.trim();
    if (!v) { focusId("ad-add-categories"); return; }
    if (S.cfg[k].some((x: string) => x.toLowerCase() === v.toLowerCase())) { toast("That's already on the list.", "worried"); return; }
    setAdd("");
    saveCfg({ [k]: S.cfg[k].concat([v]) } as any);
  }
  function removeYes() {
    const v = rm; setRm(null);
    if (v == null) return;
    if (S.cfg[k].length <= 1) { toast("Keep at least one.", "worried"); return; }
    saveCfg({ [k]: S.cfg[k].filter((x: string) => x !== v) } as any);
  }

  return (
    <div className="card adcard" style={{ maxWidth: 720 }}><h3>Categories</h3>
      <p className="muted">Shown when logging a ticket and in reports. New categories get a general icon. Removing one leaves existing tickets as they are.</p>
      {S.cfg.categories.map((v) => (
        <div className="lrow" key={v}>
          <span className="nm"><CatIcon c={v} /><span>{v}</span></span>
          <span className="ct">{plural(cnt(v), "active ticket")}</span>
          {rm === v
            ? <><button className="btn dark" data-act="ad-list-rm-yes" onClick={removeYes}>Remove</button><button className="btn" data-act="ad-list-rm-no" onClick={() => setRm(null)}>Keep</button></>
            : <button className="x" data-act="ad-list-rm" data-k={k} data-v={v} aria-label={"Remove " + v} onClick={() => setRm(v)}><Icon name="x" /></button>}
        </div>
      ))}
      <div className="addrow">
        <input className="field" id="ad-add-categories" maxLength={60} placeholder="Add a category" aria-label="New category" value={add} onChange={(e) => setAdd(e.target.value)} />
        <button className="btn dark" data-act="ad-list-add" data-k="categories" onClick={addOne}>Add</button>
      </div>
    </div>
  );
}
