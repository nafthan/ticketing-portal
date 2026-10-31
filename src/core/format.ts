/* Formatting helpers ("formatting" in the single-file edition). Pure, apart from rel() reading P.exact. */
import { P } from "./state.ts";
import { TONES } from "./constants.ts";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** HTML-escape. Only needed for the few places that still build HTML (linkify). */
export const esc = (s: any): string => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);
export const pad = (n: any): string => String(n).padStart(2, "0");

/** "YYYY-MM-DD HH:MM" in local time, or "" for an invalid date. */
export function abs(iso: any): string {
  const d = new Date(iso); if (isNaN(+d)) return "";
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}
/** A duration: "45m", "3h 05m", "2d 4h". */
export function dur(ms: number): string {
  ms = Math.abs(ms); const m = Math.round(ms / 6e4); if (m < 60) return m + "m";
  const h = Math.floor(m / 60); if (h < 24) return h + "h " + pad(m % 60) + "m";
  const d = Math.floor(h / 24); return d + "d " + (h % 24) + "h";
}
/** Relative time ("5m ago"), or the exact time when the person prefers it. */
export function rel(iso: any): string {
  if (P.exact) return abs(iso);
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 6e4) return "Just now"; if (ms < 36e5) return Math.floor(ms / 6e4) + "m ago"; if (ms < 864e5) return Math.floor(ms / 36e5) + "h ago";
  if (ms < 7 * 864e5) return Math.floor(ms / 864e5) + "d ago"; return abs(iso).slice(0, 10);
}
export function shortDate(ms: number): string { return new Date(ms).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
/** Minutes as "1h 15m". */
export function fmtMin(m: any): string { m = Math.round(m || 0); const h = Math.floor(m / 60), r = m % 60; return h ? h + "h" + (r ? " " + r + "m" : "") : r + "m"; }
/** Parse "30", "1:30", "1h 15m", "1.5h"… into minutes. 0 for blank, NaN when unreadable. */
export function parseMin(v: any): number {
  v = String(v || "").trim().toLowerCase(); if (!v) return 0; let m;
  if (/^\d+$/.test(v)) return +v;
  if ((m = v.match(/^(\d+):([0-5]\d)$/))) return +m[1] * 60 + +m[2];
  if ((m = v.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:ins?|inutes?)?)?$/)) && (m[1] || m[2])) return Math.round((+m[1] || 0) * 60 + (+m[2] || 0));
  return NaN;
}
export function fmtHrs(h: number): string { return h + " hour" + (h === 1 ? "" : "s"); }
/** "HH:MM" in local time. */
export function hm(iso: any): string { const d = new Date(iso); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
export const plural = (n: number, w: string): string => n + " " + w + (n === 1 ? "" : "s");
export function initials(n: any): string {
  const w = String(n || "").replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((w[0] || "?")[0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
}
/** [background, text] colours picked from the name. */
export function tone(n: any): [string, string] { let h = 0; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return TONES[h % TONES.length]; }
export function slug(n: any): string { return String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "x"; }
/** An ISO time as a datetime-local input value. */
export function toLocalInput(iso: any): string { const d = new Date(iso); return isNaN(+d) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); }
/** Now, as a datetime-local input value. */
export function localNow(): string { const d = new Date(); d.setSeconds(0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); }
export function median(a: number[]): number | null { if (!a.length) return null; a = a.slice().sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
/** Turn URLs in already-escaped HTML into links. */
export function linkify(h: string): string { return h.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'); }
/** The text around a search match, for highlighting: snippet() in the single-file edition, as plain text. */
export function snippetParts(text: any, query: string): { before: string; match: string; after: string } {
  const q = String(query || "").toLowerCase();
  text = String(text).replace(/\s+/g, " ");
  const i = text.toLowerCase().indexOf(q);
  if (i < 0 || !q) return { before: text.slice(0, 140) + (text.length > 140 ? "…" : ""), match: "", after: "" };
  const a = Math.max(0, i - 60), b = Math.min(text.length, i + q.length + 80);
  return { before: (a ? "…" : "") + text.slice(a, i), match: text.slice(i, i + q.length), after: text.slice(i + q.length, b) + (b < text.length ? "…" : "") };
}
