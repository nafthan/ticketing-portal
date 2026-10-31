/* Reference data. Matches "reference data" and the other constant tables in the single-file edition. */

export const SEV: Record<string, { label: string; hours: number; level: number }> = {
  S1: { label: "Critical", hours: 4, level: 4 },
  S2: { label: "High", hours: 8, level: 3 },
  S3: { label: "Medium", hours: 24, level: 2 },
  S4: { label: "Low", hours: 72, level: 1 },
};
export const STATUSES = ["new", "open", "pending", "resolved", "closing", "closed"];
export const ST_LABEL: Record<string, string> = { new: "New", open: "Open", pending: "Pending", resolved: "Resolved", closing: "Closing", closed: "Closed" };
export const ACTIVE: Set<string> = new Set(["new", "open", "pending"]);
export const RUN: Set<string> = new Set(["new", "open"]);
export const TEAMS = ["Service desk", "Networking", "Security", "Infrastructure"];
export const CATEGORIES = ["Access and accounts", "Hardware", "Software", "Email", "Network", "VPN and remote access", "Firewall", "Security incident", "Phishing", "Endpoint and malware", "Backup and recovery", "Servers and cloud"];
export const EV_LABEL: Record<string, string> = { created: "Ticket opened", status: "Status changed", severity: "Severity changed", assignee: "Assignment changed", team: "Team changed", category: "Category changed", note: "Note or time", channel: "Channel changed", timeline: "Incident timeline", customer: "Customer record", staff: "Team", settings: "Settings", shift: "Shift", request: "Request", queue: "Dispatch order", share: "Shared", email: "Email", pin: "Pinned message" };
export const APP_VERSION = "2.0.0";
export const LS_KEY = "helpdesk.local.v1";
export const LS_PREF = "helpdesk.prefs.v1";
export const LS_COL: Record<string, string> = { pins: "helpdesk.local.pins", queues: "helpdesk.local.queues", shifts: "helpdesk.local.shifts", customers: "helpdesk.local.customers", staff: "helpdesk.local.staff", events: "helpdesk.local.events", config: "helpdesk.local.config" };
/** [id, name, background, accent, kind] */
export const SKINS: [string, string, string, string, "light" | "dark"][] = [["daylight", "Daylight", "#F4F6FA", "#2F5BEA", "light"], ["peach", "Peach", "#FFF1E3", "#C2255C", "light"], ["matcha", "Matcha", "#EFF4E1", "#2F6B3A", "light"], ["cocoa", "Cocoa", "#1E1512", "#FF8FAB", "dark"], ["midnight", "Midnight", "#101010", "#ee6018", "dark"]];
export const skinKind = (id: any): "light" | "dark" | undefined => (SKINS.find((s) => s[0] === id) || ([] as any))[4];
export const CHANNELS: Record<string, string> = { phone: "Phone", email: "Email", portal: "Portal", chat: "Chat", monitoring: "Monitoring alert" };
export const TIERS: Record<string, string> = { C: "Critical", H: "High", N: "Normal", L: "Low" };
export const PHASES = ["Detection", "Analysis", "Containment", "Eradication", "Recovery", "Review"];
export const SEC_CATS: Set<string> = new Set(["Security incident", "Phishing", "Endpoint and malware"]);
export const AVAIL: Record<string, string> = { available: "Available", away: "Away", leave: "On leave" };
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const TZS = ["Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney", "UTC"];
export const TONES: [string, string][] = [["#FFD8B8", "#7A3A0C"], ["#FFC9D9", "#8A1C45"], ["#FFE28A", "#6B4A00"], ["#C4EBCF", "#1E5E3A"], ["#DCCFF7", "#47308A"], ["#C5E3F6", "#1B4F72"]];
export const EM_EVENTS: Record<string, string> = { opened: "When a ticket is opened", resolved: "When a ticket is resolved", closing: "When a ticket starts closing", closed: "When a ticket closes for good" };
export const EM_SHORT: Record<string, string> = { opened: "ticket opened", resolved: "ticket resolved", closing: "closing notice", closed: "ticket closed" };
/** routeState() → [pill class, label] */
export const ROUTE_LABEL: Record<string, [string, string]> = { ok: ["on", "Available"], off: ["", "Off shift"], away: ["", "Away"], leave: ["leave", "On leave"], full: ["wait", "At ticket limit"], gone: ["no", "No longer an agent"] };
export const CH_FIELDS: Record<string, string> = { title: "Job title", teams: "Teams", avail: "Availability", oncall: "On call", m365: "Office 365 account", other: "Something else" };
export const IMP_COLS: Record<string, Record<string, string[]>> = {
  customers: {
    customer: ["Customer", "Company", "Customer name", "Organisation", "Organization", "Client"], contact: ["Contact", "Contact name", "Name", "Full name"], email: ["Email", "Email address", "E-mail"],
    phone: ["Phone", "Telephone", "Phone number", "Mobile"], role: ["Role", "Job title", "Title", "Position"], site: ["Site", "Location", "Office", "Site name"], address: ["Site address", "Address"],
    priority: ["Priority", "Tier", "Customer priority"], prefix: ["Ticket ID prefix", "Prefix", "ID prefix", "Ticket prefix"], notes: ["Notes", "Customer notes"],
  },
  tickets: {
    id: ["ID", "Ticket", "Ticket ID", "Ticket number", "Reference", "Ref"], subject: ["Subject", "Title", "Summary"], description: ["Description", "Details", "Body", "Problem"],
    customer: ["Customer", "Company", "Client", "Organisation", "Organization"], requester: ["Requester", "Requester name", "Contact", "Caller", "Reported by"], email: ["Requester email", "Email", "Contact email"],
    phone: ["Requester phone", "Phone", "Contact phone"], category: ["Category", "Type"], team: ["Team", "Group", "Queue"], severity: ["Severity", "Priority", "Urgency"], status: ["Status", "State"],
    assignee: ["Assignee", "Assigned to", "Agent", "Owner", "Technician"], channel: ["Channel", "Source"], site: ["Site", "Location"], opened: ["Opened", "Created", "Created at", "Date opened", "Logged"],
    resolved: ["Resolved", "Resolved at", "Date resolved"], closed: ["Closed", "Closed at", "Date closed"], resolution: ["Resolution", "Resolution note", "Solution", "Fix"],
  },
};
export const BK_COLS = ["config", "pins", "customers", "staff", "queues", "shifts", "counters", "requests", "decisions", "events", "tickets"];
export const BK_NAMES: Record<string, string> = { config: "settings", pins: "pinned messages", customers: "customers", staff: "agents", queues: "Dispatch orders", shifts: "shifts", counters: "ID counters", requests: "requests", decisions: "decisions", events: "audit entries", tickets: "tickets" };
/** Words ignored when finding similar tickets. */
export const STOP: Set<string> = new Set("the and for with from that this have has are was were not but you your our can cant cannot will just been when what which into onto over after before about there their they them then than also all any via per get got its were since still some more need needs please thanks hi hello".split(" "));
