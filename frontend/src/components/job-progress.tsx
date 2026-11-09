"use client";

import { useState } from "react";
import { Check, CircleDot, PartyPopper } from "lucide-react";
import { api } from "@/lib/api";
import type { FlagType, Job } from "@/lib/types";
import { fd, signed, tk } from "@/lib/format";
import { Button, Card, Field, inputCls } from "./ui";
import { useToast } from "./shell";

type DateKey = "depotReceivedAt" | "surveyReceivedAt" | "submittedToAgentAt" | "agentBillAt" | "releasedAt";

const STEPS: { key: DateKey; label: string; ask: string; button: string; late?: FlagType }[] = [
  { key: "depotReceivedAt", label: "ডিপো রিসিভিং", ask: "ডিপো রিসিভিং কবে হলো?", button: "ডিপো রিসিভিং সেভ করুন" },
  { key: "surveyReceivedAt", label: "সার্ভে রিপোর্ট", ask: "সার্ভে রিপোর্ট হাতে পেয়েছেন?", button: "সার্ভে রিপোর্ট পেয়েছি", late: "SURVEY_LATE" },
  { key: "submittedToAgentAt", label: "এজেন্টকে জমা", ask: "শিপিং এজেন্টকে ফাইল জমা দিয়েছেন?", button: "এজেন্টকে জমা দিয়েছি" },
  { key: "agentBillAt", label: "এজেন্টের হিসাব", ask: "এজেন্টের হিসাব এসেছে? তারিখ আর আসল খরচ দিন।", button: "হিসাব এসেছে", late: "BILL_LATE" },
  { key: "releasedAt", label: "রিলিজ", ask: "টাকা ফেরত বা ফাইনাল সেটেলমেন্ট হয়েছে?", button: "রিলিজ হয়েছে", late: "OVERDUE" },
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
  const next = STEPS.findIndex((s) => !job[s.key]);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="জবের ধাপ">
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
              {state === "done" ? <Check className="size-4" strokeWidth={3} aria-hidden /> : state === "next" ? <CircleDot className="size-4" aria-hidden /> : <span className="text-[13px] font-bold">{i + 1}</span>}
            </span>
            <span className={`mt-1.5 text-[12.5px] font-semibold leading-tight sm:text-[13.5px] ${state === "late" ? "text-crit" : state === "later" ? "text-muted" : ""}`}>{s.label}</span>
            <span className={`num text-[11.5px] sm:text-[12.5px] ${flag && !date ? "font-semibold text-crit" : "text-muted"}`}>
              {date ? fd(date) : flag ? `${flag.days} দিন দেরি` : state === "next" ? "এখন বাকি" : ""}
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
          <p className="font-bold text-good">সব ধাপ শেষ। জবটা রিলিজ হয়ে গেছে।</p>
          <p className="text-sm text-muted">কিছু ভুল থাকলে নিচের &quot;সব তথ্য এডিট করুন&quot; খুলে ঠিক করুন।</p>
        </div>
      </Card>
    );

  const prev = idx > 0 ? job[STEPS[idx - 1].key] : null;
  const isBill = step.key === "agentBillAt";
  const preview = isBill && cost !== "" ? job.security - Number(cost) : null;

  async function save() {
    setErr(null);
    if (!date) return setErr("তারিখ দিন।");
    if (prev && date < prev) return setErr(`তারিখ ${STEPS[idx - 1].label}-এর (${fd(prev)}) আগে হতে পারে না।`);
    if (isBill && (cost === "" || Number(cost) < 0)) return setErr("আসল খরচ টাকায় লিখুন।");
    setBusy(true);
    try {
      await api(`/jobs/${job.id}`, {
        method: "PATCH",
        json: { ...jobPayload(job), [step!.key]: date, ...(isBill ? { actualCost: Number(cost) } : {}) },
      });
      toast(`${step!.label} সেভ হয়েছে`);
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
      <p className="text-[13px] font-bold tracking-wide text-accent">পরের কাজ · ধাপ {idx + 1} / ৫</p>
      <h2 className="mt-1 text-lg font-bold">{step.ask}</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="তারিখ" htmlFor="next-date" className="w-48">
          <input id="next-date" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {isBill && (
          <Field label="আসল খরচ (টাকা)" htmlFor="next-cost" className="w-48">
            <input id="next-cost" type="number" min={0} inputMode="numeric" className={inputCls} value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        )}
        <Button variant="primary" loading={busy} onClick={save} className="py-2.5">
          {step.button}
        </Button>
      </div>
      {preview !== null && (
        <p className="mt-3 text-sm">
          সিকিউরিটি {tk(job.security)} − খরচ {tk(Number(cost))} ={" "}
          <b className={`num ${preview > 0 ? "text-good" : preview < 0 ? "text-warn" : ""}`}>{signed(preview)}</b>{" "}
          {preview > 0 ? "(ফেরত পাবো)" : preview < 0 ? "(বাড়তি খরচ)" : ""}
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
export function nextStepLabel(job: Job) {
  const s = STEPS.find((x) => !job[x.key]);
  return s ? `পরের ধাপ: ${s.label}` : "সব ধাপ শেষ";
}
