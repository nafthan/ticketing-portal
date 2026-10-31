/*
 * The port gives exactly what the single-file edition gives, for every
 * scenario in fixtures.ts (expected values in legacy-expected.json).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { SECTIONS, NOW } from "./fixtures.ts";
import expected from "./legacy-expected.json" with { type: "json" };
import { S, ref } from "../../src/core/state.ts";
import * as format from "../../src/core/format.ts";
import * as constants from "../../src/core/constants.ts";
import * as config from "../../src/core/config.ts";
import * as hours from "../../src/core/hours.ts";
import * as people from "../../src/core/people.ts";
import * as tickets from "../../src/core/tickets.ts";
import * as csvimport from "../../src/core/csvimport.ts";
import * as routing from "../../src/core/routing.ts";
import * as queues from "../../src/core/queues.ts";
import * as similar from "../../src/core/similar.ts";
import * as history from "../../src/core/history.ts";
import * as pins from "../../src/core/pins.ts";
import * as audit from "../../src/core/audit.ts";

(globalThis as any).process.env.TZ = "UTC";
const api: any = { ...format, ...constants, ...config, ...hours, ...people, ...tickets, ...csvimport, ...routing, ...queues, ...similar, ...history, ...pins, ...audit, S, setDb: (v: any) => { ref.db = v; } };
const plain = (v: any) => JSON.parse(JSON.stringify(v));

for (const [name, run] of Object.entries(SECTIONS)) {
  test("matches the single-file edition: " + name, async () => {
    const realNow = Date.now; Date.now = () => NOW;
    try { assert.deepEqual(plain(await run(api)), (expected as any)[name]); }
    finally { Date.now = realNow; ref.db = null; config.setCfg(null); }
  });
}
