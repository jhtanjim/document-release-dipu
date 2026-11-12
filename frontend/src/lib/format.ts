import type { Lang } from "./i18n";
import type { FlagType, Role, Stage } from "./types";

/** "2026-10-25" → "25-10-2026" */
export const fd = (s: string | null | undefined) => (s ? `${s.slice(8, 10)}-${s.slice(5, 7)}-${s.slice(0, 4)}` : "—");

/** Taka with Bangladeshi grouping: 100000 → "1,00,000" */
export const tk = (n: number) => Math.abs(n).toLocaleString("en-IN");

export const signed = (n: number) => (n > 0 ? `+${tk(n)}` : n < 0 ? `−${tk(n)}` : "0");

export const FLAG_LABEL: Record<Lang, Record<FlagType, string>> = {
  bn: { SURVEY_LATE: "সার্ভে লেট", BILL_LATE: "হিসাব লেট", OVERDUE: "ওভারডিউ" },
  en: { SURVEY_LATE: "Survey late", BILL_LATE: "Bill late", OVERDUE: "Overdue" },
};

export const STAGE_LABEL: Record<Lang, Record<Stage, string>> = {
  bn: {
    NEW: "ডিপো রিসিভিং বাকি",
    DEPOT: "ডিপো রিসিভড",
    SURVEY: "সার্ভে এসেছে",
    WITH_AGENT: "এজেন্টের কাছে",
    BILLED: "হিসাব এসেছে",
    RELEASED: "রিলিজড",
  },
  en: {
    NEW: "Awaiting depot receiving",
    DEPOT: "Depot received",
    SURVEY: "Survey received",
    WITH_AGENT: "With agent",
    BILLED: "Bill received",
    RELEASED: "Released",
  },
};

export const ROLE_LABEL: Record<Lang, Record<Role, string>> = {
  bn: { SUPER_ADMIN: "সুপার অ্যাডমিন", ADMIN: "অ্যাডমিন", OPERATOR: "অপারেটর" },
  en: { SUPER_ADMIN: "Super admin", ADMIN: "Admin", OPERATOR: "Operator" },
};

export const FIELD_LABEL: Record<Lang, Record<string, string>> = {
  bn: {
    jobNo: "জব নং",
    cNumber: "C নং",
    importerId: "ইম্পোর্টার",
    agentId: "শিপিং এজেন্ট",
    containerCount: "কন্টেইনার সংখ্যা",
    containerSize: "কন্টেইনার সাইজ",
    ratePerContainer: "প্রতি কন্টেইনার রেট",
    depotReceivedAt: "ডিপো রিসিভিং",
    surveyReceivedAt: "সার্ভে রিপোর্ট",
    submittedToAgentAt: "এজেন্টে জমা",
    agentBillAt: "হিসাবের তারিখ",
    actualCost: "আসল খরচ",
    releasedAt: "রিলিজ",
    note: "নোট",
  },
  en: {
    jobNo: "Job No",
    cNumber: "C No",
    importerId: "Importer",
    agentId: "Shipping agent",
    containerCount: "Containers",
    containerSize: "Container size",
    ratePerContainer: "Rate per container",
    depotReceivedAt: "Depot receiving",
    surveyReceivedAt: "Survey report",
    submittedToAgentAt: "Submitted to agent",
    agentBillAt: "Bill date",
    actualCost: "Actual cost",
    releasedAt: "Release",
    note: "Note",
  },
};

/** Build a query string, leaving out empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "" && v !== false) u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
}
