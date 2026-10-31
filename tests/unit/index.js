/*
 * Node 22's `node --test tests/unit/` resolves the folder as a module, so it
 * loads this file, which loads every *.test.ts beside it. (Newer Node versions
 * scan the folder for *.test.ts themselves and don't run this file.)
 */
import { readdirSync } from "node:fs";

for (const f of readdirSync(new URL(".", import.meta.url)).filter((f) => f.endsWith(".test.ts")).sort()) await import("./" + f);
