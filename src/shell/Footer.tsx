/*
 * The footer: a live clock, whether it's within working hours, and the
 * connection status (tickFooter and renderConn in the single-file edition).
 * boot() in data.ts keeps S.online and S.hb current (online/offline events and
 * the 30-second heartbeat).
 */
import { useEffect, useRef, useState } from "react";
import { S, ref } from "../core/state.ts";
import { workStatus } from "../core/hours.ts";
import { useApp } from "../ui/index.tsx";

export function Footer() {
  useApp();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* working hours: recomputed when settings change or every 15 seconds */
  const ft = useRef<{ v: number; t: number; w: { open: boolean; text: string } }>({ v: -1, t: 0, w: { open: false, text: "" } });
  if (ft.current.v !== S.cfgVer || Date.now() - ft.current.t > 15000) ft.current = { v: S.cfgVer, t: Date.now(), w: workStatus() };
  const w = ft.current.w;

  const wide = typeof window !== "undefined" && window.innerWidth > 820, d = now;
  const clock = wide
    ? d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const live = S.mode === "shared", down = !S.online || (!!ref.db && !S.hb) || S.mode === "error";
  const connText = down ? "Disconnected" : live ? (S.canWrite ? "Connected" : "Connected, view only") : S.mode === "local" ? "This browser only" : "Connecting";

  return (
    <footer className="foot"><div className="foot-in">
      <time id="f-clock" dateTime={d.toISOString()}>{clock}</time>
      <span className="f-hours" id="f-hours" title={w.open ? undefined : "SLA clocks that count working time are paused until then."}>
        <span className={"dot" + (w.open ? " ok" : "")} /><span>{w.text}</span>
      </span>
      <span className={"conn" + (down ? " down" : "")} id="conn" aria-live="polite" title={down ? "Changes can't be saved until the connection comes back." : undefined}>
        <span className={"dot" + (down ? " bad" : live ? " ok" : "")} /><span>{connText}</span>
      </span>
    </div></footer>
  );
}
