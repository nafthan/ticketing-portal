/*
 * Small building blocks shared by every screen. Each matches a helper in the
 * single-file edition (noted beside it) and renders the same classes, so the
 * shared stylesheet applies unchanged.
 */
import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { S, P, subscribe, getVersion } from "../core/state.ts";
import { icon, mascot, CAT_TONE } from "../core/art.ts";
import { SEV, ST_LABEL, CHANNELS, TIERS, AVAIL } from "../core/constants.ts";
import { initials, tone } from "../core/format.ts";
import { photoOf, whoText, mTeams, onShift } from "../core/people.ts";
import { sla } from "../core/hours.ts";
import type { Customer, Staff, Ticket } from "../core/types.ts";

/** Re-render this component whenever the store changes. Call it at the top of every screen. */
export function useApp(): number {
  return useSyncExternalStore(subscribe, getVersion);
}

/** Static SVG from art.ts. Only ever used with trusted markup, never user text. */
function Svg({ html, className, style, title }: { html: string; className?: string; style?: CSSProperties; title?: string }) {
  return <span className={className} style={style} title={title} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** icon(n) */
export function Icon({ name }: { name: string }) {
  return <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: icon(name) }} />;
}

/** mascot(mood, live). Hidden when the person has turned Ping off, unless `always`. */
export function Mascot({ mood = "happy", live, className, always }: { mood?: string; live?: boolean; className?: string; always?: boolean }) {
  if (!P.mascot && !always) return null;
  let html = mascot(mood, live);
  if (className) html = html.replace('class="mascot', 'class="mascot ' + className);
  return <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** ava(uid, label, size) */
export function Ava({ uid, label, size }: { uid?: string | null; label?: string | null; size?: number }) {
  if (!P.avatars) return null;
  const st: CSSProperties = size ? ({ "--s": size + "px" } as CSSProperties) : {};
  const ph = photoOf(uid ?? null, label ?? null);
  if (ph) return <span className="av" style={st}><img alt="" src={"/_blob/" + ph} /></span>;
  if (uid) { const u = S.avatars[uid]; return <span className="av" data-ava={uid} style={st}>{u ? <img alt="" src={u} /> : null}</span>; }
  if (!label) return null;
  const t = tone(label);
  return <span className="av" aria-hidden="true" style={{ ...st, background: t[0], color: t[1] }}>{initials(label)}</span>;
}

/** who(uid, label, fallback) */
export function Who({ uid, label, fallback }: { uid?: string | null; label?: string | null; fallback?: string }) {
  // As in the single-file edition, your own name is marked "(you)" once it is known.
  if (uid) return <span data-uid={uid}>{(S.names[uid] || "Someone") + (uid === S.meId && S.names[uid] ? " (you)" : "")}</span>;
  return <>{label || fallback || "Unknown"}</>;
}

/** person(uid, label, size) */
export function Person({ uid, label, size }: { uid?: string | null; label?: string | null; size?: number }) {
  return <span className="person"><Ava uid={uid} label={label} size={size} /><span><Who uid={uid} label={label} /></span></span>;
}
export { whoText };

/** sevHtml(k) and sevMini(k) */
export function Sev({ k, mini }: { k: string; mini?: boolean }) {
  const s = (SEV as any)[k] || SEV.S3;
  return (
    <span className={"sev " + k} title={mini ? k + " " + s.label : undefined}>
      <span className="bars" aria-hidden="true">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= s.level ? "on" : undefined} />)}</span>
      <span>{mini ? k : k + " " + s.label}</span>
    </span>
  );
}

/** stHtml(k) */
export function StatusChip({ k }: { k: string }) {
  return <span className={"chip " + k}>{(ST_LABEL as any)[k] || k}</span>;
}

/** catIcon(c) */
export function CatIcon({ c }: { c: string }) {
  if (!P.avatars) return null;
  return <Svg className="cat" html={icon(c)} title={c} style={{ "--c": CAT_TONE[c] || "var(--accent)" } as CSSProperties} />;
}

/** chanIcon(c) */
export function ChanIcon({ c }: { c?: string | null }) {
  if (!c || !(CHANNELS as any)[c]) return null;
  return <Svg className="chan" html={icon(c === "email" ? "Email" : c)} title={(CHANNELS as any)[c]} />;
}

/** logo(c, name, size) */
export function Logo({ c, name, size = 28 }: { c?: Customer | null; name?: string; size?: number }) {
  if (!P.avatars) return null;
  const nm = c ? c.name : name;
  if (c && c.logoId) return <span className="logo" style={{ "--s": size + "px" } as CSSProperties}><img alt="" src={"/_blob/" + c.logoId} /></span>;
  const t = tone(nm || "?");
  return <span className="logo" aria-hidden="true" style={{ "--s": size + "px", background: t[0], color: t[1], borderColor: "transparent" } as CSSProperties}>{initials(nm)}</span>;
}

/** tierHtml(c) */
export function Tier({ c }: { c?: Customer | null }) {
  if (!c || !(TIERS as any)[c.priority]) return null;
  return <span className={"tier " + c.priority} title={(TIERS as any)[c.priority] + " priority customer"}>{c.priority}</span>;
}

/** slaHtml(t) */
export function SlaText({ t }: { t: Ticket }) {
  const s = sla(t);
  if (s.state === "breached") return <span className="breach">{s.text}</span>;
  if (s.state === "met") return <span className="met">Met</span>;
  if (s.state === "missed") return <span className="muted">Missed</span>;
  if (s.state === "paused") return <span className="muted" title="The clock is paused while the ticket is pending">{s.text}</span>;
  return <span className={s.state === "soon" ? undefined : "muted"}>{s.text}</span>;
}

/** memPills(m, g): shift, teams, availability and on-call pills for an agent. */
export function MemPills({ m, g }: { m?: Staff | null; g?: { key: string; uid: string | null; label: string | null } }) {
  const a: ReactNode[] = [];
  if (g && g.key !== "none" && S.cfg.requireShift && S.mode === "shared") a.push(onShift(g.uid, g.label) ? <span key="s" className="pill on">On shift</span> : <span key="s" className="pill">Off shift</span>);
  if (mTeams(m).length) a.push(<span key="t" className="muted" style={{ fontSize: 12, whiteSpace: "normal" }}>{mTeams(m).join(", ")}</span>);
  if (m && m.avail && m.avail !== "available") a.push(<span key="a" className={"pill" + (m.avail === "leave" ? " leave" : "")}>{(AVAIL as any)[m.avail] || m.avail}</span>);
  if (m && m.oncall) a.push(<span key="o" className="pill oncall">On call</span>);
  return a.length ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>{a}</div> : null;
}

/** spark(vals, color) */
export function Spark({ vals, color }: { vals: number[]; color: string }) {
  const max = Math.max(1, ...vals), n = vals.length;
  const pts = vals.map((v, i) => (i / (n - 1) * 100).toFixed(2) + "," + (34 - v / max * 31).toFixed(2)).join(" ");
  return (
    <svg className="sp" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** tile(label, val, extra, act, sub, hot) */
export function Tile({ label, val, children, onClick, sub, hot }: { label: string; val: ReactNode; children?: ReactNode; onClick?: () => void; sub?: string; hot?: boolean }) {
  return (
    <button className="tile" onClick={onClick}>
      <span className="lbl">{hot ? <span className="dot hot" /> : null}{label}</span>
      <span className="val">{val}</span>
      {sub ? <span title={sub}>{children}</span> : children}
    </button>
  );
}

/** opts(list, val, lab) as <option>s. Pass the value to the <select> itself. */
export function Options({ list, label }: { list: string[]; label?: (v: string) => string }) {
  return <>{list.map((o) => <option key={o} value={o}>{label ? label(o) : o}</option>)}</>;
}

/**
 * A native <dialog>, opened as a modal while mounted. Closing it (Esc, the
 * close button or a backdrop click outside the box) calls onClose.
 */
export function Dialog({ id, className = "dlg", labelledBy, onClose, children }: { id?: string; className?: string; labelledBy?: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); }
    return () => { if (d && d.open && d.close) d.close(); };
  }, []);
  return (
    <dialog ref={ref} id={id} className={className} aria-labelledby={labelledBy}
      onCancel={(e) => { e.preventDefault(); onClose(); }}>
      {children}
    </dialog>
  );
}

/** The top row of a dialog: a small label and a close button. */
export function DialogTop({ label, onClose }: { label: ReactNode; onClose: () => void }) {
  return (
    <div className="d-top"><span className="lbl">{label}</span>
      <button className="x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
    </div>
  );
}
