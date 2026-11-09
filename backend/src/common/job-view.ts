import type {
  ContainerSize,
  Importer,
  Job,
  Setting,
  ShippingAgent,
} from '@prisma/client';

/** Today's date in Bangladesh as YYYY-MM-DD, so day counts flip at local midnight. */
export const dhakaToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(
    new Date(),
  );

/** DB DATE → "YYYY-MM-DD" (or null). */
export const ymd = (d: Date | null) =>
  d ? d.toISOString().slice(0, 10) : null;

/** "YYYY-MM-DD" → Date at UTC midnight for a DATE column (or null). */
export const toDate = (s: string | null | undefined) =>
  s ? new Date(`${s}T00:00:00Z`) : null;

export const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );

export const sizeToApi = (s: ContainerSize) => (s === 'FT40' ? '40' : '20');
export const sizeFromApi = (s: string): ContainerSize =>
  s === '40' ? 'FT40' : 'FT20';

export type FlagType = 'SURVEY_LATE' | 'BILL_LATE' | 'OVERDUE';
export type Stage =
  'NEW' | 'DEPOT' | 'SURVEY' | 'WITH_AGENT' | 'BILLED' | 'RELEASED';

export type JobWithRefs = Job & { importer: Importer; agent: ShippingAgent };
export type Rules = Pick<Setting, 'surveyDays' | 'billDays' | 'releaseDays'>;

/**
 * Security, balance, stage and red marks are always computed from the stored dates and today's date,
 * never stored, so a job turns red on the right day without any background job.
 */
export function toJobView(j: JobWithRefs, rules: Rules, today = dhakaToday()) {
  const depot = ymd(j.depotReceivedAt);
  const survey = ymd(j.surveyReceivedAt);
  const submit = ymd(j.submittedToAgentAt);
  const bill = ymd(j.agentBillAt);
  const release = ymd(j.releasedAt);
  const security = j.containerCount * j.ratePerContainer;
  const balance =
    bill && j.actualCost !== null ? security - j.actualCost : null;

  const flags: { type: FlagType; days: number }[] = [];
  if (depot && !survey) {
    const n = daysBetween(depot, today);
    if (n > rules.surveyDays) flags.push({ type: 'SURVEY_LATE', days: n });
  }
  if (survey && !bill) {
    const n = daysBetween(survey, today);
    if (n >= rules.billDays) flags.push({ type: 'BILL_LATE', days: n });
  }
  if (submit && !release) {
    const n = daysBetween(submit, today);
    if (n > rules.releaseDays) flags.push({ type: 'OVERDUE', days: n });
  }

  const stage: Stage = release
    ? 'RELEASED'
    : bill
      ? 'BILLED'
      : submit
        ? 'WITH_AGENT'
        : survey
          ? 'SURVEY'
          : depot
            ? 'DEPOT'
            : 'NEW';

  return {
    id: j.id,
    jobNo: j.jobNo,
    cNumber: j.cNumber,
    importer: { id: j.importer.id, name: j.importer.name },
    agent: { id: j.agent.id, name: j.agent.name },
    containerCount: j.containerCount,
    containerSize: sizeToApi(j.containerSize),
    ratePerContainer: j.ratePerContainer,
    depotReceivedAt: depot,
    surveyReceivedAt: survey,
    submittedToAgentAt: submit,
    agentBillAt: bill,
    actualCost: j.actualCost,
    releasedAt: release,
    note: j.note,
    security,
    balance,
    stage,
    flags,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

export type JobView = ReturnType<typeof toJobView>;
