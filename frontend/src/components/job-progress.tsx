"use client";

import { useState } from "react";
import { Check, CircleDot, PartyPopper } from "lucide-react";
import { api } from "@/lib/api";
import type { FlagType, Job } from "@/lib/types";
import { fd, signed, tk } from "@/lib/format";
import { useLang, type Lang } from "@/lib/i18n";
import { Button, Card, Field, inputCls } from "./ui";
import { useToast } from "./shell";

type DateKey = "depotReceivedAt" | "surveyReceivedAt" | "submittedToAgentAt" | "agentBillAt" | "releasedAt";
type Text = Record<Lang, string>;

const STEPS: { key: DateKey; label: Text; ask: Text; button: Text; late?: FlagType }[] = [
  {
    key: "depotReceivedAt",
    label: { bn: "ডিপো রিসিভিং", en: "Depot receiving" },
    ask: { bn: "ডিপো রিসিভিং কবে হলো?", en: "When was the depot receiving?" },
    button: { bn: "ডিপো রিসিভিং সেভ করুন", en: "Save depot receiving" },
  },
  {
    key: "surveyReceivedAt",
    label: { bn: "সার্ভে রিপোর্ট", en: "Survey report" },
    ask: { bn: "সার্ভে রিপোর্ট হাতে পেয়েছেন?", en: "Have you received the survey report?" },
    button: { bn: "সার্ভে রিপোর্ট পেয়েছি", en: "Survey report received" },
    late: "SURVEY_LATE",
  },
  {
    key: "submittedToAgentAt",
    label: { bn: "এজেন্টকে জমা", en: "To agent" },
    ask: { bn: "শিপিং এজেন্টকে ফাইল জমা দিয়েছেন?", en: "Have you submitted the file to the shipping agent?" },
    button: { bn: "এজেন্টকে জমা দিয়েছি", en: "Submitted to agent" },
  },
  {
    key: "agentBillAt",
    label: { bn: "এজেন্টের হিসাব", en: "Agent's bill" },
    ask: { bn: "এজেন্টের হিসাব এসেছে? তারিখ আর আসল খরচ দিন।", en: "Has the agent's bill arrived? Enter its date and the actual cost." },
    button: { bn: "হিসাব এসেছে", en: "Bill received" },
    late: "BILL_LATE",
  },
  {
    key: "releasedAt",
    label: { bn: "রিলিজ", en: "Release" },
    ask: { bn: "টাকা ফেরত বা ফাইনাল সেটেলমেন্ট হয়েছে?", en: "Has the money come back or the final settlement been done?" },
    button: { bn: "রিলিজ হয়েছে", en: "Released" },
    late: "OVERDUE",
  },
];

const dhakaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

/** The full PATCH body for a job, so a single step can be saved without the big form. */
export function jobPayload(j: Job) {
  return {
    jobNo: j.jobNo,
    cNumber: j.cNumber,
    importerId: j.importer.id,
    agentId: j.agent.id,
    containerCount: j.containerCount,
    containerSize: j.containerSize,
    ratePerContainer: j.ratePerContainer,
    depotReceivedAt: j.depotReceivedAt,
    surveyReceivedAt: j.surveyReceivedAt,
    submittedToAgentAt: j.submittedToAgentAt,
    agentBillAt: j.agentBillAt,
    actualCost: j.actualCost,
    releasedAt: j.releasedAt,
    note: j.note,
  };
}

/** Five steps of a job left to right: done (green), late (red), next (teal), later (grey). */
export function JobSteps({ job }: { job: Job }) {
  const { lang, t } = useLang();
  const next = STEPS.findIndex((s) => !job[s.key]);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label={t("জবের ধাপ", "Job steps")}>
      {STEPS.map((s, i) => {
        const date = job[s.key];
        const flag = s.late && job.flags.find((f) => f.type === s.late);
        const state = date ? "done" : flag ? "late" : i === next ? "next" : "later";
        const dot = {
          done: "bg-good text-white border-good",
          late: "bg-crit text-white border-crit",
          next: "bg-surface text-accent border-accent",
          later: "bg-surface text-muted border-line",
        }[state];
        const bar = i < STEPS.length - 1 ? (job[STEPS[i + 1].key] || date ? "bg-good/60" : "bg-line") : "";
        return (
          <li key={s.key} className="relative flex flex-col items-center text-center">
            {i < STEPS.length - 1 && <span className={`absolute left-1/2 top-[15px] h-[3px] w-full ${bar}`} aria-hidden />}
            <span className={`relative z-10 grid size-8 place-items-center rounded-full border-2 ${dot}`}>
              {state === "done" ? (
                <Check className="size-4" strokeWidth={3} aria-hidden />
              ) : state === "next" ? (
                <CircleDot className="size-4" aria-hidden />
              ) : (
                <span className="text-[13px] font-bold">{i + 1}</span>
              )}
            </span>
            <span className={`mt-1.5 text-[12.5px] font-semibold leading-tight sm:text-[13.5px] ${state === "late" ? "text-crit" : state === "later" ? "text-muted" : ""}`}>
              {s.label[lang]}
            </span>
            <span className={`num text-[11.5px] sm:text-[12.5px] ${flag && !date ? "font-semibold text-crit" : "text-muted"}`}>
              {date ? fd(date) : flag ? t(`${flag.days} দিন দেরি`, `${flag.days} days late`) : state === "next" ? t("এখন বাকি", "Next") : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One question for the next missing step, with the date (and cost) to fill and one save button. */
export function NextStep({ job, onSaved }: { job: Job; onSaved: () => void }) {
  const toast = useToast();
  const { lang, t } = useLang();
  const idx = STEPS.findIndex((s) => !job[s.key]);
  const step = idx >= 0 ? STEPS[idx] : null;
  const [date, setDate] = useState(dhakaToday());
  const [cost, setCost] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!step)
    return (
      <Card className="flex items-center gap-3 border-good/40 bg-good-bg">
        <PartyPopper className="size-6 shrink-0 text-good" aria-hidden />
        <div>
          <p className="font-bold text-good">{t("সব ধাপ শেষ। জবটা রিলিজ হয়ে গেছে।", "All steps done. This job is released.")}</p>
          <p className="text-sm text-muted">
            {t("কিছু ভুল থাকলে নিচের \"সব তথ্য এডিট করুন\" খুলে ঠিক করুন।", "To fix a mistake, open \"Edit all details\" below.")}
          </p>
        </div>
      </Card>
    );

  const prevStep = idx > 0 ? STEPS[idx - 1] : null;
  const prev = prevStep ? job[prevStep.key] : null;
  const isBill = step.key === "agentBillAt";
  const preview = isBill && cost !== "" ? job.security - Number(cost) : null;

  async function save() {
    setErr(null);
    if (!date) return setErr(t("তারিখ দিন।", "Enter a date."));
    if (prev && prevStep && date < prev)
      return setErr(
        t(`তারিখ ${prevStep.label.bn}-এর (${fd(prev)}) আগে হতে পারে না।`, `The date can't be before ${prevStep.label.en} (${fd(prev)}).`),
      );
    if (isBill && (cost === "" || Number(cost) < 0)) return setErr(t("আসল খরচ টাকায় লিখুন।", "Enter the actual cost in taka."));
    setBusy(true);
    try {
      await api(`/jobs/${job.id}`, {
        method: "PATCH",
        json: { ...jobPayload(job), [step!.key]: date, ...(isBill ? { actualCost: Number(cost) } : {}) },
      });
      toast(t(`${step!.label.bn} সেভ হয়েছে`, `${step!.label.en} saved`));
      setCost("");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-accent/40">
      <p className="text-[13px] font-bold tracking-wide text-accent">
        {t("পরের কাজ", "Next task")} · {t("ধাপ", "Step")} {idx + 1} / 5
      </p>
      <h2 className="mt-1 text-lg font-bold">{step.ask[lang]}</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field label={t("তারিখ", "Date")} htmlFor="next-date" className="w-48">
          <input id="next-date" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {isBill && (
          <Field label={t("আসল খরচ (টাকা)", "Actual cost (taka)")} htmlFor="next-cost" className="w-48">
            <input id="next-cost" type="number" min={0} inputMode="numeric" className={inputCls} value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        )}
        <Button variant="primary" loading={busy} onClick={save} className="py-2.5">
          {step.button[lang]}
        </Button>
      </div>
      {preview !== null && (
        <p className="mt-3 text-sm">
          {t("সিকিউরিটি", "Security")} {tk(job.security)} − {t("খরচ", "cost")} {tk(Number(cost))} ={" "}
          <b className={`num ${preview > 0 ? "text-good" : preview < 0 ? "text-warn" : ""}`}>{signed(preview)}</b>{" "}
          {preview > 0 ? t("(ফেরত পাবো)", "(refund due)") : preview < 0 ? t("(বাড়তি খরচ)", "(extra cost)") : ""}
        </p>
      )}
      {err && (
        <p className="mt-2 text-sm font-semibold text-crit" role="alert">
          {err}
        </p>
      )}
    </Card>
  );
}

/** Short "what's next" text for lists. */
export function nextStepLabel(job: Job, lang: Lang = "bn") {
  const s = STEPS.find((x) => !job[x.key]);
  if (lang === "en") return s ? `Next: ${s.label.en}` : "All steps done";
  return s ? `পরের ধাপ: ${s.label.bn}` : "সব ধাপ শেষ";
}
