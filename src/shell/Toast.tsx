/* The toast with Ping (toast() in the single-file edition). Shows S.toast for 5 seconds. */
import { useEffect, useState } from "react";
import { S } from "../core/state.ts";
import { useApp, Mascot } from "../ui/index.tsx";

const SHOW_MS = 5000;

export function Toast() {
  useApp();
  const t = S.toast;
  const [, force] = useState(0);
  useEffect(() => {
    if (!t) return;
    const ms = SHOW_MS - (Date.now() - t.at);
    if (ms <= 0) return;
    const id = setTimeout(() => force((x) => x + 1), ms);
    return () => clearTimeout(id);
  }, [t]);
  const hidden = !t || Date.now() - t.at >= SHOW_MS;
  return (
    <div className="toast" id="toast" hidden={hidden} role="status">
      <span id="toast-m">{t ? <Mascot mood={t.mood || "happy"} /> : null}</span>
      <span id="toast-t">{t ? t.msg : ""}</span>
    </div>
  );
}
