/* Readable checks of the core helpers. parity.test.ts covers the same ground against the single-file edition's exact output. */
import test from "node:test";
import assert from "node:assert/strict";
import { S, ref } from "../../src/core/state.ts";
import { dur, rel, fmtMin, parseMin, snippetParts, linkify, esc } from "../../src/core/format.ts";
import { normCfg, setCfg, DEF_CFG } from "../../src/core/config.ts";
import { workBetween, addWork, sla } from "../../src/core/hours.ts";
import { nextIdNum, allocId } from "../../src/core/tickets.ts";
import { parseCSV, planTickets, csvObjects } from "../../src/core/csvimport.ts";
import { routePick, routeState, routeLine } from "../../src/core/routing.ts";
import { orderCol, planMove } from "../../src/core/queues.ts";
import { similar } from "../../src/core/similar.ts";
import { histHit } from "../../src/core/history.ts";
import { pinsFor } from "../../src/core/pins.ts";
import { csv } from "../../src/core/exports.ts";
import { fillTpl, composeUrl } from "../../src/core/emails.ts";
import { IMP_COLS } from "../../src/core/constants.ts";
import { load, NOW, CUSTOMERS, STAFF, SHIFTS, NAMES, ROUTE_TICKETS, ROUTE_CATS, QUEUES, SIM_TICKETS, PINS, HIST_TICKET } from "./fixtures.ts";

(globalThis as any).process.env.TZ = "UTC";
const H = 36e5, at = (s: string) => Date.parse(s);
function withNow(fn: () => any) { const real = Date.now; Date.now = () => NOW; try { return fn(); } finally { Date.now = real; } }

test("dur, rel, fmtMin, parseMin", () => {
  assert.equal(dur(45 * 6e4), "45m");
  assert.equal(dur(3 * H + 5 * 6e4), "3h 05m");
  assert.equal(dur(-(52 * H)), "2d 4h");
  withNow(() => {
    assert.equal(rel(new Date(NOW - 20e3).toISOString()), "Just now");
    assert.equal(rel(new Date(NOW - 5 * 6e4).toISOString()), "5m ago");
    assert.equal(rel(new Date(NOW - 3 * H).toISOString()), "3h ago");
    assert.equal(rel(new Date(NOW - 2 * 24 * H).toISOString()), "2d ago");
    assert.equal(rel("2026-09-01T10:00:00Z"), "2026-09-01");
  });
  assert.equal(fmtMin(0), "0m"); assert.equal(fmtMin(60), "1h"); assert.equal(fmtMin(75), "1h 15m");
  assert.equal(parseMin(""), 0); assert.equal(parseMin("30"), 30); assert.equal(parseMin("1:30"), 90);
  assert.equal(parseMin("1h 15m"), 75); assert.equal(parseMin("1.5h"), 90); assert.equal(parseMin("20 minutes"), 20);
  assert.ok(isNaN(parseMin("soon"))); assert.ok(isNaN(parseMin("1:75")));
});

test("snippetParts, linkify, esc", () => {
  const p = snippetParts("x".repeat(100) + " the  Router  restarted " + "y".repeat(100), "router");
  assert.equal(p.match, "Router"); assert.ok(p.before.startsWith("…")); assert.ok(p.after.endsWith("…")); assert.ok(p.before.endsWith("the "));
  assert.deepEqual(snippetParts("short text", "short"), { before: "", match: "short", after: " text" });
  assert.equal(linkify(esc("see https://example.com/a?b=1&c=2.")), 'see <a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">https://example.com/a?b=1&amp;c=2</a>.');
});

test("normCfg fills defaults and rejects bad values", () => {
  const d = normCfg(null);
  assert.equal(d.tz, "Europe/London"); assert.deepEqual(d.days, [1, 2, 3, 4, 5]); assert.equal(d.start, "08:00"); assert.equal(d.idPrefix, "HD");
  assert.deepEqual(d.targets.S3, { hours: 16, always: false }); assert.equal(d.rules.graceDays, 3); assert.equal(d.shareUrl, undefined);
  assert.notEqual(d.teams, DEF_CFG.teams, "a copy, not the defaults themselves");
  const c = normCfg({ tz: "Nowhere/Land", days: [6, 6, 0, 8], start: "18:00", end: "09:00", idPrefix: "fai", rules: { maxActive: 3.4, soonHours: 100, graceDays: 0 }, shareUrl: "https://x.example", targets: { S1: { hours: -1 }, S2: { hours: "6", always: 1 } } });
  assert.equal(c.tz, "Europe/London"); assert.deepEqual(c.days, [0, 6]); assert.equal(c.start, "08:00"); assert.equal(c.idPrefix, "FAI");
  assert.equal(c.rules.maxActive, 3); assert.equal(c.rules.soonHours, 4); assert.equal(c.rules.graceDays, 0); assert.equal(c.shareUrl, "https://x.example");
  assert.deepEqual(c.targets.S1, { hours: 4, always: true }); assert.deepEqual(c.targets.S2, { hours: 6, always: true });
  assert.deepEqual(normCfg({ routing: { cats: { A: ["u:x", "bad", "u:x"] } } }).routing, { on: true, retry: true, cats: { A: ["u:x"] } });
});

test("working time across weekends, holidays and the clocks changing", () => {
  setCfg(null);
  assert.equal(workBetween(at("2026-10-30T16:00:00Z"), at("2026-11-02T10:00:00Z")), 4 * H, "Fri 16-18, Mon 08-10");
  assert.equal(workBetween(at("2026-10-23T16:00:00Z"), at("2026-10-26T09:00:00Z")), 2 * H, "BST Fri 17-18 local, GMT Mon 08-09");
  assert.equal(workBetween(at("2026-12-24T17:00:00Z"), at("2026-12-29T09:00:00Z")), 2 * H, "25th and 28th are holidays");
  assert.equal(workBetween(at("2026-10-30T16:00:00Z"), at("2026-11-02T10:00:00Z"), true), 66 * H);
  assert.equal(addWork(at("2026-10-30T17:00:00Z"), 3 * H), at("2026-11-02T10:00:00Z"));
  assert.equal(addWork(at("2026-10-27T05:00:00Z"), 2 * H), at("2026-10-27T10:00:00Z"));
  setCfg({ days: [], start: "08:00", end: "18:00" });
  assert.equal(normCfg({ days: [] }).days.length, 5, "an empty list keeps the default days");
  setCfg(null);
});

test("sla pauses while pending and uses customer targets", () => {
  setCfg(null);
  withNow(() => {
    const h = (a: string, from: string, to: string) => ({ at: a, type: "status", from, to });
    load(S, { customers: CUSTOMERS, tickets: [
      { id: "A", severity: "S3", status: "open", customerId: "c-acme", createdAt: "2026-10-26T09:00:00Z", updatedAt: "x", resolvedAt: null, history: [h("2026-10-26T11:00:00Z", "new", "pending"), h("2026-10-27T09:00:00Z", "pending", "open")] },
      { id: "B", severity: "S2", status: "pending", customerId: "c-acme", createdAt: "2026-10-26T09:00:00Z", updatedAt: "x", resolvedAt: null, history: [h("2026-10-26T10:00:00Z", "new", "pending")] },
      { id: "C", severity: "S3", status: "open", customerId: "c-fast", createdAt: "2026-10-27T09:00:00Z", updatedAt: "x", resolvedAt: null, history: [] },
      { id: "D", severity: "S1", status: "open", customerId: "c-acme", createdAt: "2026-10-27T05:00:00Z", updatedAt: "x", resolvedAt: null, history: [] },
    ] });
    const [a, b, c, d] = S.tickets.map(sla);
    assert.equal(a.el, 5 * H); assert.equal(a.state, "ok"); assert.equal(a.due, at("2026-10-28T13:00:00Z"));
    assert.equal(b.state, "paused"); assert.equal(b.text, "Paused, 7h 00m left");
    assert.equal(c.tg.hours, 4); assert.equal(c.tg.custom, true); assert.equal(c.state, "soon"); assert.equal(c.text, "1h 00m left");
    assert.equal(d.state, "breached"); assert.equal(d.text, "Breached 3h 00m"); assert.equal(d.tg.always, true);
  });
});

test("customer ticket numbering", async () => {
  setCfg(null);
  load(S, { customers: CUSTOMERS, tickets: [{ id: "ACME1" }, { id: "ACME3" }] });
  const acme = S.custById.get("c-acme")!;
  assert.equal(nextIdNum(acme), 4);
  assert.equal(nextIdNum(null), 1);
  S.counters = { ACME: { next: 9 } }; assert.equal(nextIdNum(acme), 9);
  assert.equal(await allocId("c-acme"), "ACME9"); assert.deepEqual(S.counters.ACME, { next: 10 });
  S.byId.set("ACME10", { id: "ACME10" } as any);
  assert.equal(await allocId("c-acme"), "ACME11", "skips ids already in use");
  assert.match(await allocId("c-fast"), /^HD-[A-Z2-9]{5}$/);
});

test("parseCSV handles quotes, semicolons, a BOM and CRLF", () => {
  assert.deepEqual(parseCSV("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCSV("﻿Name;Note\r\nJo;\"a; b\"\r\n\r\nSam;\"say \"\"hi\"\"\"\r\n"), [["Name", "Note"], ["Jo", "a; b"], ["Sam", 'say "hi"']]);
  assert.deepEqual(parseCSV("x\ty\n\"two\nlines\"\t2"), [["x", "y"], ["two\nlines", "2"]]);
  assert.deepEqual(parseCSV(" , \n"), []);
  const o = csvObjects("Ticket ID,Title,Colour\nA1,Hi,red", IMP_COLS.tickets);
  assert.deepEqual(o.head, ["id", "subject", null]); assert.deepEqual(o.unknown, ["Colour"]); assert.deepEqual(o.list, [{ _row: 2, id: "A1", subject: "Hi" }]);
});

test("planTickets maps statuses, dates, people and warns", () => {
  setCfg(null);
  load(S, { customers: CUSTOMERS, staff: STAFF, names: NAMES, tickets: [{ id: "OLD1" }] as any });
  const { list } = csvObjects("ID,Subject,Customer,Status,Severity,Assignee,Opened,Closed\nOLD1,Dup,,,,,2026-01-01,\nN1,Hello,Acme Ltd,closed,P1,Ana Ames,05/02/2026 09:00,06/02/2026 10:00\n,New one,Zed Co,,,Eve Label,2026-02-07,", IMP_COLS.tickets);
  const p = planTickets(list);
  assert.equal(p.skipped, 1); assert.equal(p.rows.length, 2);
  assert.deepEqual([p.rows[0].st, p.rows[0].sev, p.rows[0].opened, p.rows[0].closedAt, p.rows[0].asg], ["closed", "S1", "2026-02-05T09:00:00.000Z", "2026-02-06T10:00:00.000Z", { uid: "ana", label: null }]);
  assert.deepEqual([p.rows[1].st, p.rows[1].asg], ["open", { uid: null, label: "Eve Label" }]);
  assert.deepEqual(p.newCust, ["Zed Co"]);
  assert.ok(p.warn.includes("Row 2: OLD1 already exists, skipped."));
});

test("routePick follows the order and skips the unavailable", () => {
  setCfg({ routing: { cats: ROUTE_CATS } }); ref.db = {};
  load(S, { staff: STAFF, shifts: SHIFTS, names: NAMES, tickets: ROUTE_TICKETS });
  const st = (id: string) => routeState(S.staff.find((m) => m.id === id));
  assert.deepEqual(["u-ana", "u-ben", "u-cat", "u-dev", "l-eve"].map(st), ["ok", "away", "leave", "off", "ok"]);
  assert.equal(routeState(null), "gone");
  assert.equal(routePick({ category: "Network", history: [] })!.id, "u-ana", "ben away, cat on leave, dev off shift");
  assert.equal(routePick({ category: "Email", history: [] })!.id, "l-eve", "a missing agent is skipped");
  assert.equal(routePick({ category: "Hardware", history: [] }), null);
  assert.equal(routePick({ category: "Firewall", history: [{ at: "x", type: "assignee", from: "fay", to: null } as any] })!.id, "u-ana", "whoever handed it back is skipped");
  setCfg({ routing: { cats: ROUTE_CATS }, rules: { maxActive: 2 } });
  assert.equal(routeState(S.staff.find((m) => m.id === "u-fay")), "full");
  assert.deepEqual(routeLine("Network"), { text: "Will be auto-assigned to Ana Ames, first available for Network.", tone: "ok" });
  assert.deepEqual(routeLine("Hardware"), { text: "Nobody in the Hardware order is available, so it will wait in Unassigned until someone is.", tone: "wait" });
  assert.equal(routeLine("Software"), null);
  ref.db = null; setCfg(null);
});

test("orderCol and planMove keep a manager's order", () => {
  setCfg(null);
  withNow(() => {
    load(S, { tickets: ROUTE_TICKETS, customers: CUSTOMERS });
    const un = S.tickets.filter((t) => ["new", "open", "pending"].includes(t.status) && !t.assigneeId);
    assert.deepEqual(orderCol(un, "none").map((t) => t.id), ["R5", "R3", "R7", "R6", "R4"], "no custom order: severity then SLA");
    S.queues = JSON.parse(JSON.stringify(QUEUES));
    assert.deepEqual(orderCol(un, "none").map((t) => t.id), ["R5", "R7", "R6", "R4", "R3"], "custom order, with others slotted in by severity");
    assert.deepEqual(planMove("none", "R3", "R6", null), { order: ["R5", "R7", "R3", "R6", "R4"], pos: 3 });
    assert.deepEqual(planMove("none", "R5", null, "R3"), { order: ["R7", "R6", "R4", "R3", "R5"], pos: 5 });
    assert.equal(planMove("none", "R6", "R4", null), null, "already there");
    assert.equal(planMove("none", "R1", null, null), null, "not in this list");
  });
});

test("similar finds related tickets", () => {
  load(S, { tickets: SIM_TICKETS, customers: CUSTOMERS });
  assert.deepEqual(similar("Outlook crashing when opening").map((x) => x.t.id), ["S2", "S1"]);
  assert.deepEqual(similar("printer offline", { exclude: "S3" }).map((x) => x.t.id), ["S6"]);
  assert.deepEqual(similar("printer"), [], "needs two words");
  const boosted = similar("Outlook crashing when opening", { customerId: "c-acme", category: "Email" });
  assert.ok(boosted[1].sc > similar("Outlook crashing when opening")[1].sc);
});

test("histHit says where the search matched", () => {
  load(S, { customers: CUSTOMERS, names: NAMES });
  assert.deepEqual(histHit(HIST_TICKET, ""), { ok: true });
  assert.deepEqual(histHit(HIST_TICKET, "ana ames"), { ok: true });
  assert.deepEqual(histHit(HIST_TICKET, "bulging"), { ok: true, where: "Description", text: HIST_TICKET.description });
  assert.deepEqual(histHit(HIST_TICKET, "courier"), { ok: true, where: "Note", text: "Courier booked for Friday" });
  assert.deepEqual(histHit(HIST_TICKET, "replacement"), { ok: true, where: "Internal note", text: "Ordered a replacement battery" });
  assert.deepEqual(histHit(HIST_TICKET, "comms room"), { ok: true, where: "Timeline", text: "Isolated the device in the comms room" });
  assert.deepEqual(histHit(HIST_TICKET, "nothing"), { ok: false });
});

test("pinsFor hides expired pins from agents", () => {
  withNow(() => {
    load(S, { pins: PINS }); ref.db = {}; S.isEditor = true;
    assert.deepEqual(pinsFor("queue").map((p) => [p.id, p.expired]), [["p4", false], ["p2", false], ["p5", true], ["p1", true]]);
    S.isEditor = false;
    assert.deepEqual(pinsFor("dispatch").map((p) => p.id), ["p4", "p3"]);
    ref.db = null;
  });
});

test("csv escapes quotes and formulas", () => {
  assert.equal(csv([["a", 'say "hi"', null, 3], ["=SUM(A1)", "-2", "@x", "+1"]]), '"a","say ""hi""","","3"\r\n"\'=SUM(A1)","\'-2","\'@x","\'+1"');
});

test("email templates", () => {
  assert.equal(fillTpl("Hi {contact},\n\n\n\n{unknown} {ticket}", { contact: "Jo", ticket: "HD-1" }), "Hi Jo,\n\n{unknown} HD-1");
  setCfg(null);
  const m: any = { to: "jo@x.example", subject: "A & B", body: "Line 1\nLine 2" };
  assert.equal(composeUrl(m), "https://outlook.office.com/mail/deeplink/compose?to=jo%40x.example&subject=A%20%26%20B&body=Line%201%0ALine%202");
  setCfg({ email: { app: "mailto" } });
  assert.equal(composeUrl(m), "mailto:jo@x.example?subject=A%20%26%20B&body=Line%201%0ALine%202");
  setCfg(null);
});
