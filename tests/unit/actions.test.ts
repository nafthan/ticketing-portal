/* Actions in local mode (no backend): what they store, log and say. */
import test from "node:test";
import assert from "node:assert/strict";
import { S, ref } from "../../src/core/state.ts";
import { setCfg, saveCfg, announcePost, rulesSave } from "../../src/core/config.ts";
import { createTicket, setField, changeStatus, submitResolve, assign, addNote, takeTicket } from "../../src/core/tickets.ts";
import { moveInQueue } from "../../src/core/queues.ts";
import { savePin, removePin } from "../../src/core/pins.ts";
import { setupSave, maybeSetup } from "../../src/core/setup.ts";
import { saveContact, saveSite, custField } from "../../src/core/customers.ts";
import { loadDemo, index } from "../../src/core/data.ts";
import { load, CUSTOMERS, STAFF } from "./fixtures.ts";

(globalThis as any).process.env.TZ = "UTC";
const tick = () => new Promise((r) => setTimeout(r, 0));
function reset(extra?: any) {
  ref.db = null; ref.col = null; setCfg(extra || null);
  load(S, { customers: CUSTOMERS, staff: STAFF });
  S.events = []; S.queues = []; S.pins = []; S.dialog = null; S.toast = null; S.loaded = true; S.cfgKnown = false; S.cfgExists = false; S.view = "queue";
}
const newTicket = (o?: any) => Object.assign({ subject: "Switch down", description: "Core switch offline", customer: "Fastlane", customerId: "c-fast", requesterName: "Pat Doe", requesterEmail: "pat@fast.example", team: "Networking", category: "Network", severity: "S2", channel: "phone" }, o);

test("createTicket auto-assigns, records history and writes the opened email", async () => {
  reset({ routing: { cats: { Network: ["u:nobody", "l:Eve Label"] } } });
  const id = await createTicket(newTicket());
  assert.match(id, /^HD-[A-Z2-9]{5}$/);
  const t = S.byId.get(id)!;
  assert.equal(t.status, "open"); assert.equal(t.assigneeLabel, "Eve Label"); assert.equal(t.assigneeId, null);
  assert.deepEqual(t.history.map((e) => [e.type, e.by, e.byLabel, !!e.auto]), [["created", null, "This device", false], ["assignee", null, "This device", true], ["status", null, "This device", true]]);
  assert.equal(t.history[1].reason, "Network auto-assign order");
  assert.equal(t.emails![0].subject, "[" + id + "] We've received your request: Switch down");
  assert.equal(t.emails![0].to, "pat@fast.example"); assert.equal(t.emails![0].status, "pending");
  assert.match(t.emails![0].body, /^Hi Pat,\n\nThanks for getting in touch/);
  const id2 = await createTicket(newTicket({ customer: "Acme Ltd", customerId: "c-acme", category: "Software" }));
  assert.equal(id2, "ACME2", "customer prefix, starting at idStart"); assert.equal(S.byId.get(id2)!.status, "new");
});

test("closing goes through the grace period; force closes for good", async () => {
  reset();
  const id = await createTicket(newTicket({ category: "Software" }));
  assert.equal(await setField(id, "status", "closed"), true);
  let t = S.byId.get(id)!;
  assert.equal(t.status, "closing"); assert.ok(t.resolvedAt);
  assert.ok(Math.abs(new Date(t.closingUntil!).getTime() - (Date.now() + 3 * 864e5)) < 5000);
  assert.deepEqual(t.emails!.map((m) => m.event), ["opened", "closing"]);
  assert.match(S.toast!.msg, /^Closing\. It can be reopened until /);
  assert.deepEqual(t.history.slice(-1).map((e) => [e.type, e.from, e.to]), [["status", "new", "closing"]]);
  changeStatus(id, "closed"); await tick(); await tick();
  t = S.byId.get(id)!; assert.equal(t.status, "closed", "closing → closed is forced"); assert.equal(t.closingUntil, null);
  assert.equal(await setField(id, "status", "closed", true), false, "no change, nothing saved");
});

test("resolve dialog: required note and time", async () => {
  reset({ rules: { noteToResolve: true, timeToResolve: true } });
  const id = await createTicket(newTicket({ category: "Software" }));
  changeStatus(id, "resolved");
  assert.deepEqual(S.dialog, { kind: "resolve", id, to: "resolved" });
  assert.equal(await submitResolve(id, "resolved", { text: " ", internal: false, minutes: "", billable: true }), "Add a resolution note.");
  assert.equal(await submitResolve(id, "resolved", { text: "Fixed", internal: false, minutes: "soon", billable: true }), "Enter the time like 30m, 1h 15m or 1:30.");
  assert.equal(await submitResolve(id, "resolved", { text: "Fixed", internal: false, minutes: "", billable: true }), "Log the time spent on this ticket.");
  assert.equal(await submitResolve(id, "resolved", { text: "Rebooted it", internal: false, minutes: "1h 15m", billable: true }), null);
  assert.equal(S.dialog, null);
  await tick(); await tick();
  const t = S.byId.get(id)!;
  assert.deepEqual(t.notes.map((n) => [n.text, n.minutes, n.billable, n.internal]), [["Resolution: Rebooted it", 75, true, false]]);
  assert.equal(t.status, "resolved"); assert.equal(S.toast!.msg, "Resolved. One less on the pile.");
});

test("addNote logs time-only entries", async () => {
  reset();
  const id = await createTicket(newTicket({ category: "Software" }));
  await addNote(id, "", true, 30, false);
  const e = S.byId.get(id)!.history.slice(-1)[0];
  assert.deepEqual([e.type, e.internal, e.minutes, e.billable, e.timeOnly], ["note", true, 30, false, true]);
});

test("assign respects view-only access and moves new tickets to open", async () => {
  reset();
  const id = await createTicket(newTicket({ category: "Software" }));
  S.canWrite = false;
  assert.equal(await assign(id, null, "Eve Label"), false); assert.equal(S.toast!.msg, "You have view-only access.");
  S.canWrite = true;
  assert.equal(await assign(id, null, "Eve Label"), true);
  const t = S.byId.get(id)!;
  assert.equal(t.status, "open");
  assert.deepEqual(t.history.slice(-2).map((e) => [e.type, e.from, e.to, e.toLabel]), [["assignee", null, null, "Eve Label"], ["status", "new", "open", undefined]]);
  assert.equal(takeTicket(id), undefined, "nobody signed in");
});

test("moveInQueue saves the order and logs it", async () => {
  reset();
  index([]);
  const a = await createTicket(newTicket({ category: "Software", severity: "S1" })), b = await createTicket(newTicket({ category: "Software", severity: "S4" }));
  moveInQueue("none", b, a, null); await tick(); await tick();
  assert.deepEqual(S.queues.find((q) => q.id === "none")!.order, [b, a]);
  const ev = S.events.find((e) => e.type === "queue")!;
  assert.deepEqual([ev.action, ev.target, ev.targetLabel, ev.detail, ev.byLabel], ["reordered", null, null, b + " to position 1", "This device"]);
});

test("saveCfg describes the change in the audit log", async () => {
  reset();
  await saveCfg({ name: "Ops desk", rules: Object.assign({}, S.cfg.rules, { graceDays: 0 }) });
  assert.equal(S.cfg.name, "Ops desk"); assert.equal(S.cfgExists, true); assert.equal(S.toast!.msg, "Saved.");
  /* As in the single-file edition, the defaults have no shareUrl, so the first save from defaults also logs it as cleared. */
  assert.equal(S.events.slice(-1)[0].detail, "Helpdesk name helpdesk → Ops desk; Link for shared tickets cleared; Grace period after closing (days): 3 → off");
  await saveCfg({ name: "Ops desk" }); assert.equal(S.toast!.msg, "Nothing has changed.");
  assert.equal(await announcePost("  ", "info", ""), "Write the message first.");
  assert.equal(await announcePost("Down", "info", "2020-01-01T10:00"), "Pick a time in the future, or leave it blank.");
  assert.equal(await announcePost("Outage", "warning", ""), null);
  assert.deepEqual([S.cfg.announce!.text, S.cfg.announce!.tone, S.cfg.announce!.byLabel], ["Outage", "warning", "This device"]);
  assert.equal(await rulesSave({ requireShift: true, noteToResolve: false, timeToResolve: false, maxActive: 300, maxShiftHours: 0, soonHours: 4, autoCloseDays: 0, graceDays: 3 }), "Most active tickets needs a number from 0 to 200.");
});

test("savePin validates, saves and removes", async () => {
  reset();
  assert.equal(await savePin(null, { text: "  ", tone: "info", show: "both", until: "" }), "Write the message you want to pin.");
  assert.equal(await savePin(null, { text: "Hi", until: "nonsense" }), "That date isn't valid.");
  assert.equal(await savePin(null, { text: "Hi", until: "2020-01-01T10:00" }), "Choose a time in the future, or leave it empty to keep it pinned.");
  S.dialog = { kind: "pin", id: null };
  assert.equal(await savePin(null, { title: " Router ", text: "Reboot at 6", tone: "loud", show: "queue", until: "" }), null);
  const p = S.pins[0];
  assert.deepEqual([p.title, p.text, p.tone, p.show, p.until, p.byLabel, !!p.createdAt], ["Router", "Reboot at 6", "note", "queue", null, "This device", true]);
  assert.equal(S.dialog, null); assert.equal(S.toast!.msg, "Pinned for the team.");
  assert.equal(await savePin(p.id, { title: "Router", text: "Reboot at 7", tone: "warning", show: "both", until: "" }), null);
  assert.equal(S.pins.length, 1); assert.equal(S.pins[0].text, "Reboot at 7"); assert.equal(S.pins[0].createdAt, p.createdAt);
  await removePin(p.id); assert.equal(S.pins.length, 0); assert.equal(S.toast!.msg, "Unpinned.");
  assert.deepEqual(S.events.filter((e) => e.type === "pin").map((e) => e.action), ["created", "updated", "removed"]);
});

test("first-run setup", async () => {
  reset(); index([]);
  S.cfgKnown = true; maybeSetup(); assert.deepEqual(S.dialog, { kind: "setup" });
  S.dialog = null; maybeSetup(); assert.equal(S.dialog, null, "only offered once");
  const v = { name: "Desk", prefix: "ops", teams: "Alpha\n Beta \nAlpha\n", cats: "Email", tz: "UTC", start: "09:00", end: "17:00", days: [1, 2, 3] };
  assert.equal(await setupSave(Object.assign({}, v, { name: " " })), "Give the helpdesk a name.");
  assert.equal(await setupSave(Object.assign({}, v, { prefix: "too-long" })), "The prefix needs 1 to 6 letters or numbers.");
  assert.equal(await setupSave(Object.assign({}, v, { teams: "\n" })), "Add at least one team.");
  assert.equal(await setupSave(Object.assign({}, v, { days: [] })), "Choose at least one working day.");
  assert.equal(await setupSave(Object.assign({}, v, { end: "08:00" })), "The working day has to end after it starts.");
  assert.equal(await setupSave(v), null);
  assert.deepEqual([S.cfg.name, S.cfg.idPrefix, S.cfg.teams, S.cfg.categories, S.cfg.tz, S.cfg.days], ["Desk", "OPS", ["Alpha", "Beta"], ["Email"], "UTC", [1, 2, 3]]);
  assert.equal(S.events.slice(-1)[0].detail, "First-run setup: Desk, prefix OPS, 2 teams, 1 category");
});

test("customer contacts, sites and fields", async () => {
  reset(); S.selCust = "c-fast";
  assert.equal(saveContact("new", { name: " " }), "Add the contact's name.");
  assert.equal(saveContact("new", { name: "Lee", email: "lee@" }), "That email address doesn't look complete.");
  assert.equal(saveSite("new", { name: "" }), "Give the site a name, like Head office or the town it's in.");
  assert.equal(saveSite("new", { name: "Depot", address: "1 Road" }), null); await tick(); await tick();
  const site = S.custById.get("c-fast")!.sites![0];
  assert.equal(saveContact("new", { name: " Lee ", email: "lee@fast.example", site: site.id, role: "IT" }), null); await tick(); await tick();
  const c = S.custById.get("c-fast")!;
  assert.deepEqual([c.contacts![0].name, c.contacts![0].siteId, c.contacts![0].role], ["Lee", site.id, "IT"]);
  await custField("idPrefix", "acme");
  assert.equal(S.toast!.msg, "Acme Ltd already uses ACME. Each customer needs its own prefix.");
  await custField("priority", "C");
  assert.equal(S.custById.get("c-fast")!.priority, "C");
  assert.deepEqual(S.events.filter((e) => e.type === "customer").map((e) => [e.action, e.detail]), [["updated", "Site added: Depot"], ["contact-added", "Lee"], ["updated", "Priority High → Critical"]]);
  S.selCust = null;
});

test("loadDemo moves the sample dates up to now", () => {
  reset();
  loadDemo();
  assert.ok(S.tickets.length > 5); assert.ok(S.customers.length > 0); assert.ok(S.staff.length > 0);
  const newest = Math.max(...S.tickets.map((t) => new Date(t.createdAt).getTime()));
  assert.ok(newest <= Date.now() + 1000 && newest > Date.now() - 864e5 * 2, "newest sample ticket is recent");
  assert.equal(S.toast!.msg, "Sample data loaded. Remove it any time from Admin.");
});
