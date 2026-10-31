/*
 * Data shapes. These match what's stored through the backend (see PLATFORM.md),
 * so a field added here usually means a PLATFORM.md update too.
 * Times are ISO 8601 strings in UTC.
 */

export type Severity = "S1" | "S2" | "S3" | "S4";
export type Status = "new" | "open" | "pending" | "resolved" | "closing" | "closed";
export type Channel = "phone" | "email" | "portal" | "chat" | "monitoring";
export type Tier = "C" | "H" | "N" | "L";

export interface Actor { by: string | null; byLabel?: string | null }

export interface HistoryEntry extends Actor {
  at: string;
  type: string;            // created | status | severity | assignee | team | category | note | email | channel | timeline | share
  from?: any; to?: any;
  auto?: boolean; reason?: string; imported?: boolean;
  [k: string]: any;
}
export interface Note extends Actor { at: string; text: string; internal?: boolean; minutes?: number; billable?: boolean; [k: string]: any }
export interface TimelineEntry extends Actor { id?: string; at: string; phase?: string; text: string; [k: string]: any }
export interface Email { id: string; event: string; to: string; subject: string; body: string; at: string; status: "pending" | "sent" | "skipped"; [k: string]: any }

export interface Ticket {
  id: string;
  subject: string; description: string;
  status: Status; severity: Severity;
  team: string; category: string; channel: Channel | null;
  customerId: string | null; customer: string;
  contactId: string | null; siteId: string | null; site: string;
  requesterName: string; requesterEmail: string; requesterPhone: string;
  assigneeId: string | null; assigneeLabel: string | null;
  createdAt: string; updatedAt: string; resolvedAt: string | null; closedAt?: string | null; closingUntil?: string | null;
  createdBy: string | null;
  notes: Note[]; history: HistoryEntry[]; timeline: TimelineEntry[];
  incident: boolean; emails?: Email[];
  sample?: boolean; imported?: boolean;
  [k: string]: any;
}

export interface Contact { id: string; name: string; email?: string; phone?: string; role?: string; siteId?: string }
export interface Site { id: string; name: string; address?: string }
export interface Customer {
  id: string; name: string; priority: Tier; allHours?: boolean;
  sla?: Partial<Record<Severity, { hours: number; always: boolean }>>;
  notes?: string; contacts?: Contact[]; sites?: Site[]; logoId?: string | null;
  idPrefix?: string; idStart?: number;
  createdAt?: string; updatedAt?: string; sample?: boolean; imported?: boolean;
  [k: string]: any;
}

export interface Staff {
  id: string; uid: string | null; label: string | null;
  teams?: string[]; team?: string; title?: string; avail?: string; oncall?: boolean; photo?: string | null; m365?: string;
  sample?: boolean;
  [k: string]: any;
}
export interface Shift { id: string; uid: string | null; label: string | null; on: boolean; since?: string; [k: string]: any }
export interface Queue { id: string; ids: string[]; [k: string]: any }
export interface RequestDoc { id: string; items?: any[]; [k: string]: any }
export interface Decision { [k: string]: any }
export interface AuditEvent extends Actor { id?: string; at: string; type: string; [k: string]: any }
export interface Pin extends Actor {
  id: string; title?: string; text: string; tone: "note" | "info" | "warning" | "critical";
  show: "both" | "queue" | "dispatch"; until: string | null; createdAt: string; updatedAt?: string;
}

/** Workspace settings (config/settings). normCfg() in config.ts fills in defaults. */
export interface Config {
  name: string; shareUrl: string; idPrefix: string;
  teams: string[]; categories: string[];
  tz: string; days: number[]; start: string; end: string; holidays: string[];
  targets: Record<Severity, { hours: number; always: boolean }>;
  defaults: { severity: Severity; channel: Channel; team: string };
  rules: { noteToResolve: boolean; timeToResolve: boolean; maxActive: number; soonHours: number; autoCloseDays: number; maxShiftHours: number; graceDays: number; [k: string]: any };
  email: { app: "outlook" | "mailto"; templates: Record<string, { on: boolean; subject: string; body: string }> };
  announce: null | { text: string; tone: "info" | "warning" | "critical"; until: string | null; at: string | null; by: string | null; byLabel: string | null };
  routing: { on: boolean; retry: boolean; cats: Record<string, string[]> };
  requireShift: boolean;
  [k: string]: any;
}

export interface Prefs {
  mode: "light" | "dark" | "system"; lightTheme: string; darkTheme: string;
  board: "board" | "list"; mineView: "board" | "list"; histView: "board" | "list"; histGroup: "month" | "agent" | "category" | "customer";
  density: "cosy" | "compact"; mascot: boolean; squeak: boolean;
  notifyDecisions: boolean; notifyNew: boolean; notifySound: boolean;
  avatars: boolean; exact: boolean; start: string; mine: boolean; team: string; noteInternal: boolean;
  [k: string]: any;
}

/** The one dialog open at a time. Actions open them with openDialog(); <Dialogs/> renders them. */
export type Dialog =
  | { kind: "newTicket"; customerId?: string }
  | { kind: "resolve"; id: string; to: "resolved" | "closed" }
  | { kind: "request"; draft: any }
  | { kind: "clockOut" }
  | { kind: "share"; id: string }
  | { kind: "account"; tab?: string }
  | { kind: "pin"; id: string | null }
  | { kind: "import"; plan: any }
  | { kind: "restore"; data: any }
  | { kind: "setup" };
