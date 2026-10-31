/*
 * Drag and drop for My desk and Dispatch, as in the single-file edition's
 * document-level dragstart/dragover/drop/dragend handlers. Spread `dnd` on a
 * container (#mine-body, #disp-body): React delegates the events, so cards
 * (.tk) and rows from MiniTable (.tkr) inside any column (.colm) or agent
 * group (.agent-group) work alike.
 *
 * Dropping inside the column a ticket came from reorders it (managers save,
 * agents send a request through moveInQueue); dropping on another column with
 * data-drop reassigns it. The drop line is a transient DOM node, inserted and
 * removed here exactly as the original did.
 */
import type { DragEvent } from "react";
import { S } from "../core/state.ts";
import { isMgr, canRequest } from "../core/people.ts";
import { assign } from "../core/tickets.ts";
import { moveInQueue } from "../core/queues.ts";

let dragId: string | null = null;
let dragQ: string | null = null;

/** True while a ticket is being dragged (the periodic refresh waits for it). */
export function dragging(): boolean { return !!dragId; }

const COL = ".colm,.agent-group";
const CARD = ".tk,.tkr";

function near(e: { target: EventTarget | null }, sel: string): HTMLElement | null {
  const t = e.target as any;
  return t && t.closest ? (t.closest(sel) as HTMLElement | null) : null;
}

/** dropSpot(col, y): the card the pointer is above, or the last one. */
export function dropSpot(col: HTMLElement, y: number): { before: string | null; el: HTMLElement | null; last?: string | null } {
  const cards = [...col.querySelectorAll<HTMLElement>(".tk:not(.dragging),.tkr:not(.dragging)")];
  for (const c of cards) { const r = c.getBoundingClientRect(); if (y < r.top + r.height / 2) return { before: c.dataset.id || null, el: c }; }
  return { before: null, el: null, last: cards.length ? cards[cards.length - 1].dataset.id || null : null };
}
export function clearLine(): void { document.querySelectorAll(".dropline-row,.dropline").forEach((n) => n.remove()); }
export function makeLine(forRow: boolean): HTMLElement {
  if (!forRow) { const d = document.createElement("div"); d.className = "dropline"; return d; }
  const tr = document.createElement("tr"); tr.className = "dropline-row"; tr.innerHTML = '<td colspan="9"><div class="dropline"></div></td>'; return tr;
}

const canOrder = () => S.canWrite && (isMgr() || canRequest());

function cleanup(): void {
  dragId = null; dragQ = null; clearLine();
  document.querySelectorAll(".agent-group.over").forEach((n) => n.classList.remove("over"));
  document.querySelectorAll(".dragging,.over").forEach((n) => n.classList.remove("dragging", "over"));
}

function onDragStart(e: DragEvent<HTMLElement>): void {
  const c = near(e, CARD); if (!c) return;
  dragId = c.dataset.id || null;
  const col = c.closest(COL) as HTMLElement | null;
  dragQ = col ? col.dataset.q ?? null : null;
  c.classList.add("dragging");
  try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId || ""); } catch { /* some browsers refuse */ }
}

function onDragEnd(): void { cleanup(); }

function onDragOver(e: DragEvent<HTMLElement>): void {
  const col = dragId ? near(e, COL) : null;
  if (col && col.dataset.q === dragQ && canOrder()) {
    e.preventDefault();
    document.querySelectorAll(".colm.over,.agent-group.over").forEach((n) => n.classList.remove("over"));
    const sp = dropSpot(col, e.clientY), cs = col.querySelectorAll<HTMLElement>(CARD), isRow = !!(cs[0] && cs[0].tagName === "TR");
    clearLine();
    const ln = makeLine(isRow);
    if (sp.el) sp.el.before(ln); else if (cs.length) cs[cs.length - 1].after(ln);
    return;
  }
  clearLine();
  const c = dragId ? near(e, "[data-drop]") : null;
  document.querySelectorAll(".colm.over,.agent-group.over").forEach((n) => { if (n !== c) n.classList.remove("over"); });
  if (!c) return;
  e.preventDefault();
  c.classList.add("over");
}

function onDrop(e: DragEvent<HTMLElement>): void {
  const col = dragId ? near(e, COL) : null;
  if (col && col.dataset.q === dragQ && canOrder()) {
    e.preventDefault();
    const sp = dropSpot(col, e.clientY), id = dragId as string, q = dragQ as string;
    cleanup();
    if (sp.before !== id) moveInQueue(q, id, sp.before, sp.before ? null : sp.last ?? null);
    return;
  }
  const c = dragId ? near(e, "[data-drop]") : null;
  if (!c) return;
  e.preventDefault();
  const id = dragId as string, k = c.dataset.drop || "";
  c.classList.remove("over");
  cleanup();
  assign(id, k.startsWith("u:") ? k.slice(2) : null, k.startsWith("l:") ? k.slice(2) : null);
}

/** Spread on the container that holds the columns or agent groups. */
export const dnd = { onDragStart, onDragEnd, onDragOver, onDrop };

/**
 * The up/down arrows ("mv"): move the ticket past its neighbour in the column
 * it's shown in, as the original read them from the page.
 */
export function moveStep(el: HTMLElement, dir: "up" | "down", id: string, q: string): void {
  const col = el.closest(COL); if (!col) return;
  const ids = [...col.querySelectorAll<HTMLElement>(CARD)].map((c) => c.dataset.id), i = ids.indexOf(id);
  if (dir === "up" && i > 0) moveInQueue(q, id, ids[i - 1] as string, null);
  if (dir === "down" && i >= 0 && i < ids.length - 1) moveInQueue(q, id, null, ids[i + 1] as string);
}
