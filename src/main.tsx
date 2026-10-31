import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App.tsx";
import { boot } from "./core/data.ts";

createRoot(document.getElementById("root")!).render(<App />);
boot();
