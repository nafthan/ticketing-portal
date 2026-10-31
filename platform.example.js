/*
 * helpdesk platform adapter: starter and reference implementation
 * ---------------------------------------------------------------
 * The helpdesk page reaches its backend only through `window.claude.use(name)`,
 * which returns four services: "db", "user", "assets" and "downloads".
 * PLATFORM.md describes exactly what each must do.
 *
 * This file is a complete, working adapter that keeps everything in the
 * browser (localStorage, synced live between tabs). It exists so you can:
 *   1. see the contract in running code,
 *   2. try the shared, signed-in experience on one machine, and
 *   3. replace the parts marked "REPLACE" with calls to your own systems.
 *
 * It is NOT secure and NOT shared between computers. Do not use it as-is
 * for real data. Real access rules must be enforced on your server.
 *
 * How to use it:
 *   - Copy this file to platform.js next to index.html.
 *   - In index.html, uncomment <script src="platform.js"></script> in <head>.
 *   - Open adapter-test.html to check it, then open index.html.
 *   - Add ?as=agent or ?as=viewer to the URL to try the other roles.
 */
(function () {
  "use strict";

  /* ======================================================================
   * 1. WHO IS SIGNED IN                                              REPLACE
   * ----------------------------------------------------------------------
   * Return the signed-in person and their role. In production, ask your
   * sign-in system, for example:
   *   const r = await fetch("/api/me", { credentials: "include" });
   *   return await r.json();   // { id, name, avatarUrl, role }
   * Map your groups or app roles to: "manager", "agent" or "viewer".
   * `id` must be stable and opaque (for example an Entra ID object id).
   * ==================================================================== */
  const DIRECTORY = [
    { id: "demo-manager", name: "Morgan Manager", role: "manager" },
    { id: "demo-agent", name: "Alex Agent", role: "agent" },
    { id: "demo-agent-2", name: "Sam Support", role: "agent" },
    { id: "demo-viewer", name: "Vic Viewer", role: "viewer" },
  ];
  async function currentUser() {
    const as = new URLSearchParams(location.search).get("as") || "manager";
    const u = DIRECTORY.find((d) => d.role === as) || DIRECTORY[0];
    return Object.assign({ avatarUrl: "" }, u);
  }
  // REPLACE: look people up in your directory (for assigning and adding agents).
  async function lookupPeople(ids) {
    return DIRECTORY.filter((d) => ids.includes(d.id));
  }
  async function searchPeople(query) {
    const q = String(query || "").toLowerCase();
    return DIRECTORY.filter((d) => !q || d.name.toLowerCase().includes(q)).slice(0, 8);
  }

  /* ======================================================================
   * 2. ACCESS RULES                                  ENFORCE ON YOUR SERVER
   * ----------------------------------------------------------------------
   * These mirror the table in PLATFORM.md. Checking them here only makes the
   * demo behave realistically; anyone can bypass browser code. Your API must
   * apply the same rules to every request.
   * ==================================================================== */
  function canWrite(user, path) {
    if (user.role === "viewer") return false;
    const [col, id, sub] = path.split("/");
    if (col === "data") return id === "users" && sub === user.id; // data/users/{uid}/prefs: owner only
    if (user.role === "manager") return true;
    if (["config", "staff", "queues", "decisions"].includes(col)) return false;
    if (col === "shifts" || col === "requests") return id === user.id; // agents: their own only
    return true; // tickets, customers, events, counters, _adaptertest
  }
  function canRead(user, path) {
    const [col, id, sub] = path.split("/");
    if (col === "data") return id === "users" && sub === user.id;
    if (col === "requests" && user.role !== "manager") return id === user.id;
    return true;
  }

  /* ======================================================================
   * 3. STORAGE                                                       REPLACE
   * ----------------------------------------------------------------------
   * In production these become calls to your API and database (for example
   * Cosmos DB, Postgres or Firestore), and change notifications arrive over
   * WebSockets, Server-Sent Events or your database's change feed.
   *
   * The demo keeps every document in one object, keyed by full path
   * ("tickets/HD-7K2QM"), saves it to localStorage, and tells other tabs
   * about changes with BroadcastChannel.
   * ==================================================================== */
  const KEY = "helpdesk.adapter.demo.v1";
  let docs = {};
  try { docs = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { docs = {}; }
  const leases = {};
  const listeners = new Set();
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(KEY) : null;

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(docs)); }
    catch (e) { throw err("quota_exceeded", "Browser storage is full."); }
  }
  function changed(fromOtherTab) {
    if (!fromOtherTab && channel) channel.postMessage("changed");
    listeners.forEach((l) => { try { l(); } catch (e) { console.error(e); } });
  }
  if (channel) channel.onmessage = () => {
    try { docs = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) {}
    changed(true);
  };

  /* ---------------------------------------------------------------------- */
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const err = (code, message) => ({ code, message: message || code });
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  function merge(a, b) {
    const out = Object.assign({}, a);
    for (const k of Object.keys(b)) out[k] = isObj(out[k]) && isObj(b[k]) ? merge(out[k], b[k]) : b[k];
    return out;
  }
  function checkPath(path, wantDoc) {
    const parts = String(path).split("/");
    if (!path || parts.some((p) => !p) || (parts.length % 2 === 0) !== wantDoc) throw err("invalid_argument", "Bad path: " + path);
  }
  function snapDoc(path) {
    const id = path.split("/").pop(), data = docs[path];
    return { id, exists: data !== undefined, data: () => clone(data) };
  }

  let me = null;
  const ready = currentUser().then((u) => { me = u; return u; });

  /* ---------------------------------------------------------------------- */
  function docRef(path) {
    checkPath(path, true);
    return {
      id: path.split("/").pop(),
      path,
      async get() {
        await ready;
        if (!canRead(me, path)) throw err("invalid_argument", "Not allowed");
        return snapDoc(path);
      },
      async set(obj) {
        await ready;
        if (!isObj(obj)) throw err("invalid_argument", "set() needs an object");
        if (!canWrite(me, path)) throw err("invalid_argument", "Not allowed");
        docs[path] = clone(obj); persist(); changed();
      },
      async update(obj) {
        await ready;
        if (!isObj(obj)) throw err("invalid_argument", "update() needs an object");
        if (!canWrite(me, path)) throw err("invalid_argument", "Not allowed");
        if (docs[path] === undefined) throw err("invalid_argument", "Document does not exist");
        docs[path] = merge(docs[path], clone(obj)); persist(); changed();
      },
      async delete() {
        await ready;
        if (!canWrite(me, path)) throw err("invalid_argument", "Not allowed");
        delete docs[path]; delete leases[path]; persist(); changed();
      },
      // Optional: a short lease so only one browser does a job at a time.
      // REPLACE with an atomic check-and-set on your server (for example an
      // ETag/If-Match update, or SELECT ... FOR UPDATE).
      async acquire({ holder, ttlMs } = {}) {
        await ready;
        const now = Date.now(), ttl = Math.min(600000, Math.max(1000, ttlMs || 10000)), cur = leases[path];
        if (cur && cur.until > now && cur.holder !== holder) return { acquired: false, holder: cur.holder, expiresAt: cur.until };
        leases[path] = { holder: holder || "anon", until: now + ttl };
        return { acquired: true, expiresAt: leases[path].until };
      },
      onSnapshot(next, error) {
        let last = null, first = true; // always report once, even if the document doesn't exist yet
        const run = async () => {
          await ready;
          if (!canRead(me, path)) { if (error) error(err("invalid_argument", "Not allowed")); return; }
          const s = JSON.stringify(docs[path]) || "";
          if (!first && s === last) return;
          first = false; last = s; next(snapDoc(path));
        };
        listeners.add(run); run();
        return () => listeners.delete(run);
      },
      collection(sub) { return query(path + "/" + sub); },
    };
  }

  const OPS = {
    "==": (a, b) => a === b, "!=": (a, b) => a !== b, "<": (a, b) => a < b, "<=": (a, b) => a <= b,
    ">": (a, b) => a > b, ">=": (a, b) => a >= b, "in": (a, b) => Array.isArray(b) && b.includes(a),
    "not-in": (a, b) => Array.isArray(b) && !b.includes(a), "array-contains": (a, b) => Array.isArray(a) && a.includes(b),
  };

  function query(colPath, spec) {
    checkPath(colPath, false);
    spec = spec || { where: [], order: null, limit: null };
    const run = () => {
      const prefix = colPath + "/", depth = colPath.split("/").length + 1;
      let list = Object.keys(docs)
        .filter((p) => p.startsWith(prefix) && p.split("/").length === depth && canRead(me, p)) // people only see what they may read
        .map((p) => ({ path: p, id: p.slice(prefix.length), data: docs[p] }))
        .filter((d) => spec.where.every(([f, op, v]) => d.data[f] !== undefined && OPS[op](d.data[f], v)));
      if (spec.order) {
        const [f, dir] = spec.order, m = dir === "desc" ? -1 : 1;
        list.sort((a, b) => {
          const x = a.data[f], y = b.data[f];
          if (x === undefined && y === undefined) return a.id < b.id ? -1 : 1;
          if (x === undefined) return 1; if (y === undefined) return -1; // missing sorts last
          return x < y ? -m : x > y ? m : a.id < b.id ? -1 : 1;
        });
      } else list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      if (spec.limit) list = list.slice(0, spec.limit);
      const out = list.map((d) => ({ id: d.id, exists: true, data: () => clone(d.data) }));
      return { docs: out, size: out.length, empty: !out.length };
    };
    const q = {
      path: colPath,
      where(f, op, v) {
        if (!OPS[op]) throw err("invalid_argument", "Unknown operator " + op);
        if (spec.where.length >= 10) throw err("invalid_argument", "Too many filters");
        return query(colPath, Object.assign({}, spec, { where: spec.where.concat([[f, op, v]]) }));
      },
      orderBy(f, dir) { return query(colPath, Object.assign({}, spec, { order: [f, dir === "desc" ? "desc" : "asc"] })); },
      limit(n) {
        if (!(n >= 1 && n <= 1000)) throw err("invalid_argument", "limit must be 1 to 1000");
        return query(colPath, Object.assign({}, spec, { limit: Math.floor(n) }));
      },
      async get() { await ready; return run(); },
      onSnapshot(next, error) {
        let last;
        const go = async () => {
          await ready;
          const snap = run(), sig = JSON.stringify(snap.docs.map((d) => [d.id, d.data()]));
          if (sig === last) return;
          last = sig; next(snap);
        };
        listeners.add(go); go();
        return () => listeners.delete(go);
      },
      doc(id) {
        if (id === undefined) id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        return docRef(colPath + "/" + id);
      },
    };
    return q;
  }

  const db = {
    collection: (path) => query(path),
    doc: (path) => docRef(path),
  };

  /* ======================================================================
   * 4. USER SERVICE
   * ==================================================================== */
  const user = {
    async me() { const u = await ready; return { id: u.id, name: u.name, avatarUrl: u.avatarUrl || "", isOwner: u.role === "manager" }; },
    async can(perm) { const u = await ready; return perm === "data.write" ? u.role !== "viewer" : false; },
    async canEdit() { const u = await ready; return u.role === "manager"; },
    async profiles(ids) {
      const u = await ready, out = {};
      for (const p of await lookupPeople([].concat(ids || []))) out[p.id] = { id: p.id, name: p.name, avatarUrl: p.avatarUrl || "", isMe: p.id === u.id };
      return out;
    },
    async search(q) { return (await searchPeople(q)).map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl || "" })); },
  };

  /* ======================================================================
   * 5. FILE STORAGE (logos and profile photos)                       REPLACE
   * ----------------------------------------------------------------------
   * The page shows stored images from /_blob/{id}, so your server must serve
   * that path. A sketch:
   *   async upload(blob) {
   *     const r = await fetch("/api/blobs", { method: "POST", body: blob, credentials: "include" });
   *     return await r.json();          // { id: "<32 lowercase hex>", url: "/_blob/<id>" }
   *   },
   *   async delete(id) { await fetch("/api/blobs/" + id, { method: "DELETE", credentials: "include" }); }
   * Returning null (as here) hides logo and photo uploads.
   * ==================================================================== */
  const assets = null;

  /* ======================================================================
   * 6. DOWNLOADS (CSV, backups, incident timelines)
   * ----------------------------------------------------------------------
   * A plain browser download is all most deployments need.
   * ==================================================================== */
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: "text/plain" });
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return { status: "saved" };
    },
  };

  /* ---------------------------------------------------------------------- */
  const services = { db, user, assets, downloads };
  window.claude = Object.assign(window.claude || {}, {
    use: async (name) => (Object.prototype.hasOwnProperty.call(services, name) ? services[name] : null),
  });
})();
