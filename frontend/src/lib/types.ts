export type Role = "SUPER_ADMIN" | "ADMIN" | "OPERATOR";

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "সুপার অ্যাডমিন",
  ADMIN: "অ্যাডমিন",
  OPERATOR: "অপারেটর",
};

/** Admin rights: rates, rules, deleting jobs. The super admin has them too. */
export const isAdmin = (role?: Role) => role === "ADMIN" || role === "SUPER_ADMIN";
export type FlagType = "SURVEY_LATE" | "BILL_LATE" | "OVERDUE";
export type Stage = "NEW" | "DEPOT" | "SURVEY" | "WITH_AGENT" | "BILLED" | "RELEASED";

export interface Me {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface NamedRef {
  id: number;
  name: string;
}

export interface Importer extends NamedRef {
  active: boolean;
  jobCount: number;
}
export type Agent = Importer;

export interface Flag {
  type: FlagType;
  days: number;
}

export interface Job {
  id: number;
  jobNo: string;
  cNumber: string | null;
  importer: NamedRef;
  agent: NamedRef;
  containerCount: number;
  containerSize: "20" | "40";
  ratePerContainer: number;
  depotReceivedAt: string | null;
  surveyReceivedAt: string | null;
  submittedToAgentAt: string | null;
  agentBillAt: string | null;
  actualCost: number | null;
  releasedAt: string | null;
  note: string | null;
  security: number;
  balance: number | null;
  stage: Stage;
  flags: Flag[];
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEntry {
  id: number;
  action: "CREATE" | "UPDATE" | "DELETE";
  user: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  createdAt: string;
}

export interface JobDetail extends Job {
  history: HistoryEntry[];
}

export interface JobList {
  today: string;
  items: Job[];
}

export interface Settings {
  defaultRate: number;
  surveyDays: number;
  billDays: number;
  releaseDays: number;
}

export interface GroupSum {
  importerId: number;
  name: string;
  sum: number;
  count: number;
}

export interface Dashboard {
  today: string;
  settings: Settings;
  counts: { surveyLate: number; billLate: number; overdue: number; open: number; total: number; awaitingDepot: number };
  awaitingDepot: Job[];
  plusTotal: number;
  minusTotal: number;
  plusByImporter: GroupSum[];
  minusByImporter: GroupSum[];
  attention: Job[];
}

export interface Statement {
  today: string;
  items: Job[];
  totals: { plus: number; minus: number; net: number; pending: number; jobs: number };
  matrix: {
    importers: NamedRef[];
    agents: NamedRef[];
    cells: { importerId: number; agentId: number; count: number }[];
  };
}

export interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}
