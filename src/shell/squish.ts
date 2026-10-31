/*
 * Squishy Ping: press any element with class "squishy" (the brand mascot
 * #brand-m in the header, the big one #hero-m on the Queue) and Ping squashes,
 * says something and, if you like, squeaks. Spam it and Ping gets dizzy; keep a
 * steady rhythm and Ping plays the Tetris theme.
 *
 * Like the single-file edition this works by delegation: installSquish() adds
 * document listeners once (the Header does this) and acts on whichever
 * `.squishy` element was pressed. The face swap writes the element's innerHTML
 * directly, so a squishy element must render its mascot with
 * dangerouslySetInnerHTML on itself (the stylesheet uses `.squishy>svg`), with
 * the same markup sqRestore() puts back:
 *   brand: mascot("happy")
 *   hero (#hero-m): P.mascot ? mascot(S.heroMood || "happy", true) : ""
 */
import { P, S, toast, commit } from "../core/state.ts";
import { mascot } from "../core/art.ts";

const SQ_ANIMS = ["squash", "jelly", "boing", "spin", "pancake", "stretch", "shake", "inflate", "flip", "melt"];
const SQ_WORDS = ["squish!", "boing", "eep!", "hehe", "pop!", "squeak", "mmf", "wheee", "bloop", "blorp", "again!", "ow?", "boop", "sproing", "*wobble*"];
const SQ_BITS = ["✦", "♥", "✿", "★", "•", "✧"];
const SQ_MILES: Record<number, string> = {
  25: "25 squishes. Ping appreciates you.",
  100: "100 squishes! Ping is now noticeably flatter.",
  250: "250 squishes. Have you considered a tea break?",
  500: "500 squishes. Ping has seen things.",
  1000: "1,000 squishes. Ping is legally your friend now.",
};
/* Korobeiniki, the 19th-century Russian folk tune better known as the Tetris theme. Frequencies in Hz. */
const SQ_TUNE = (() => {
  const N: Record<string, number> = { A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880 };
  return "E5 B4 C5 D5 C5 B4 A4 A4 C5 E5 D5 C5 B4 C5 D5 E5 C5 A4 A4 D5 F5 A5 G5 F5 E5 C5 E5 D5 C5 B4 B4 C5 D5 E5 C5 A4 A4".split(" ").map((n) => N[n]);
})();

let sqLast = "", sqTimes: number[] = [], sqCount = 0, actx: AudioContext | null = null;
let sqStreak = 0, sqLastAt = 0, sqNote = 0, sqMusic = false;
try { sqCount = +(localStorage.getItem("helpdesk.squishes") || 0) || 0; } catch (e) { /* no storage */ }
const sqReduce = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Pending restore timers per element (el._ft in the single-file edition). -1 means pressed, not yet released. */
const timers = new WeakMap<Element, any>();

/** How many times Ping has been squished in this browser. The hero hides its "psst, squish me" hint once this is above 0. */
export function squishes(): number { return sqCount; }

/** True while an element is mid-squish, so callers shouldn't replace its face. */
export function sqBusy(el: Element | null): boolean { return !!(el && timers.get(el)); }

function sqFace(el: HTMLElement, face: string) { el.innerHTML = mascot(face, el.id === "hero-m"); }

function clearAnims(el: HTMLElement) { SQ_ANIMS.concat(["dizzy"]).forEach((x) => el.classList.remove("a-" + x)); }

export function sqRestore(el: HTMLElement): void {
  timers.delete(el);
  clearAnims(el);
  if (el.id === "hero-m") el.innerHTML = P.mascot ? mascot(S.heroMood || "happy", true) : "";
  else sqFace(el, "happy");
}

function sqBurst(el: HTMLElement, word: string, n: number, big: boolean, music?: boolean) {
  if (sqReduce) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * 0.4;
  const mk = (txt: string, cls: string, dx: number, dy: number, rot: number) => {
    const s = document.createElement("span");
    s.className = "sq-fx" + (cls ? " " + cls : "");
    s.textContent = txt;
    s.setAttribute("aria-hidden", "true");
    s.style.left = cx + "px"; s.style.top = cy + "px";
    s.style.setProperty("--dx", dx + "px"); s.style.setProperty("--dy", dy + "px"); s.style.setProperty("--r", rot + "deg");
    if (cls === "word") s.style.setProperty("--fs", big ? "15px" : "11px");
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1000);
  };
  mk(word, "word", (Math.random() - 0.5) * 50, -(r.height * 0.75 + 18), (Math.random() - 0.5) * 16);
  const bits = music ? ["♪", "♫", "♬", "♩"] : SQ_BITS;
  for (let i = 0; i < n; i++) mk(bits[Math.floor(Math.random() * bits.length)], "", (Math.random() - 0.5) * r.width * 1.8, -(10 + Math.random() * r.height * 0.9), (Math.random() - 0.5) * 120);
}

function sqSound(kind: string, note?: number) {
  if (!P.squeak) return;
  try {
    actx = actx || new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    const a = actx!;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    if (note) {
      o.type = "sine"; o.frequency.setValueAtTime(note * 0.8, t); o.frequency.exponentialRampToValueAtTime(note * 1.12, t + 0.05); o.frequency.exponentialRampToValueAtTime(note, t + 0.1);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.setValueAtTime(0.12, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.28); return;
    }
    const f = kind === "dizzy" ? 260 : 520 + Math.random() * 520;
    o.type = "sine"; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (kind === "dizzy" ? 0.45 : 2.1), t + 0.12); o.frequency.exponentialRampToValueAtTime(f * (kind === "dizzy" ? 0.8 : 1.3), t + 0.22);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.26);
  } catch (e) { /* no audio */ }
}

/** Squish one element (normally called by the delegated listeners from installSquish()). */
export function squish(el: HTMLElement): void {
  if (!P.mascot) return;
  const now = Date.now(), gap = now - sqLastAt; sqLastAt = now;
  sqTimes = sqTimes.filter((x) => now - x < 4000); sqTimes.push(now);
  if (sqMusic && gap > 1200) { sqMusic = false; sqStreak = 0; }
  if (!sqMusic) { sqStreak = gap < 700 ? sqStreak + 1 : 1; if (sqStreak >= 15) { sqMusic = true; sqNote = 0; } }
  const big = el.id === "hero-m", music = sqMusic, dizzy = !music && sqTimes.length >= 8;
  let a: string;
  if (dizzy) { a = "dizzy"; sqTimes = []; }
  else { do a = SQ_ANIMS[Math.floor(Math.random() * SQ_ANIMS.length)]; while (a === sqLast); }
  sqLast = a; el.classList.remove("pressed");
  clearAnims(el); void el.offsetWidth; el.classList.add("a-" + a);
  sqFace(el, dizzy ? "dizzy" : ["squish", "party", "blush", "squish"][Math.floor(Math.random() * 4)]);
  clearTimeout(timers.get(el));
  timers.set(el, setTimeout(() => sqRestore(el), dizzy ? 1900 : 1000));
  if (music) {
    const i = sqNote % SQ_TUNE.length; sqNote++;
    sqBurst(el, ["♪", "♫", "♬", "♩"][i % 4], big ? 4 : 2, big, true); sqSound("squeak", SQ_TUNE[i]);
    if (sqNote === SQ_TUNE.length) setTimeout(() => toast("Ping has been practising.", "party"), 400);
  } else {
    sqBurst(el, dizzy ? "whoa…" : SQ_WORDS[Math.floor(Math.random() * SQ_WORDS.length)], big ? 5 : 2, big);
    sqSound(dizzy ? "dizzy" : "squeak");
  }
  sqCount++;
  try { localStorage.setItem("helpdesk.squishes", String(sqCount)); } catch (e) { /* no storage */ }
  const h = document.getElementById("sq-hint"); if (h) h.hidden = true;
  if (sqCount === 1) commit(); // lets the hero re-render its hint as hidden
  const mile = SQ_MILES[sqCount];
  if (mile) setTimeout(() => toast(mile, "party"), 700);
}

function onDown(e: PointerEvent) {
  const el = (e.target as Element | null)?.closest?.(".squishy") as HTMLElement | null;
  if (!el || !P.mascot) return;
  el.classList.add("pressed");
  if (!sqBusy(el)) { timers.set(el, -1); sqFace(el, "squish"); }
}
function onUp() { document.querySelectorAll<HTMLElement>(".squishy.pressed").forEach((el) => squish(el)); }
function onCancel() { document.querySelectorAll<HTMLElement>(".squishy.pressed").forEach((el) => { el.classList.remove("pressed"); sqRestore(el); }); }
function onKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (el && el.classList && el.classList.contains("squishy") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); squish(el); }
}

let installs = 0;
/** Add the document listeners that make every `.squishy` element squishable. Returns a cleanup function. Safe to call more than once. */
export function installSquish(): () => void {
  if (installs++ === 0) {
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("keydown", onKey, true);
  }
  return () => {
    if (--installs === 0) {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("keydown", onKey, true);
    }
  };
}
