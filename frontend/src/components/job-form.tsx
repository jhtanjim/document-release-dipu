"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { api, useApi } from "@/lib/api";
import type { Agent, Importer, Job, Settings } from "@/lib/types";
import { signed, tk } from "@/lib/format";
import { Button, Card, Field, inputCls } from "./ui";
import { useToast } from "./shell";

type FormState = {
  jobNo: string;
  cNumber: string;
  importerId: string;
  agentId: string;
  containerCount: string;
  containerSize: "20" | "40";
  ratePerContainer: string;
  depotReceivedAt: string;
  surveyReceivedAt: string;
  submittedToAgentAt: string;
  agentBillAt: string;
  actualCost: string;
  releasedAt: string;
  note: string;
};

const DATES = [
  ["depotReceivedAt", "ডিপো রিসিভিং"],
  ["surveyReceivedAt", "সার্ভে রিপোর্ট"],
  ["submittedToAgentAt", "এজেন্টে জমা"],
  ["agentBillAt", "এজেন্টের হিসাব"],
  ["releasedAt", "রিলিজ"],
] as const;

function fromJob(j: Job | undefined, defaultRate: number): FormState {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
  return {
    jobNo: j?.jobNo ?? "",
    cNumber: j?.cNumber ?? "",
    importerId: j ? String(j.importer.id) : "",
    agentId: j ? String(j.agent.id) : "",
    containerCount: j ? String(j.containerCount) : "1",
    containerSize: j?.containerSize ?? "20",
    ratePerContainer: String(j?.ratePerContainer ?? defaultRate),
    depotReceivedAt: j ? j.depotReceivedAt ?? "" : today,
    surveyReceivedAt: j?.surveyReceivedAt ?? "",
    submittedToAgentAt: j?.submittedToAgentAt ?? "",
    agentBillAt: j?.agentBillAt ?? "",
    actualCost: j?.actualCost != null ? String(j.actualCost) : "",
    releasedAt: j?.releasedAt ?? "",
    note: j?.note ?? "",
  };
}

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {};
  if (!f.jobNo.trim()) e.jobNo = "জব নম্বর দিন।";
  if (f.cNumber && !/^\d+$/.test(f.cNumber.trim())) e.cNumber = "শুধু সংখ্যা দিন, যেমন 254777।";
  if (!f.importerId) e.importerId = "ইম্পোর্টার বাছাই করুন।";
  if (!f.agentId) e.agentId = "শিপিং এজেন্ট বাছাই করুন।";
  if (!(Number(f.containerCount) >= 1) || !Number.isInteger(Number(f.containerCount))) e.containerCount = "কমপক্ষে ১টা কন্টেইনার।";
  if (f.ratePerContainer === "" || !(Number(f.ratePerContainer) >= 0)) e.ratePerContainer = "রেট টাকায় লিখুন।";
  if (f.agentBillAt && f.actualCost === "") e.actualCost = "হিসাবের তারিখ দিলে আসল খরচও লিখুন।";
  if (f.actualCost !== "" && !f.agentBillAt) e.agentBillAt = "আসল খরচ লিখলে হিসাবের তারিখও দিন।";
  let prev: (typeof DATES)[number] | null = null;
  for (const d of DATES) {
    if (f[d[0]]) {
      if (prev && f[d[0]] < f[prev[0]]) e[d[0]] = `${d[1]}-এর তারিখ ${prev[1]}-এর আগে হতে পারে না।`;
      prev = d;
    }
  }
  return e;
}

function NamedSelect({
  id,
  label,
  value,
  onChange,
  list,
  kind,
  error,
  onCreated,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  list: Importer[] | null;
  kind: "importers" | "agents";
  error?: string;
  onCreated: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  async function add() {
    setBusy(true);
    setErr(null);
    try {
      const created = await api<Importer>(`/${kind}`, { json: { name: name.trim() } });
      onCreated();
      onChange(String(created.id));
      toast(`${created.name} যোগ হয়েছে`);
      setAdding(false);
      setName("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={label} htmlFor={id} error={error ?? err ?? undefined}>
      {adding ? (
        <div className="flex gap-2">
          <input
            id={id}
            autoFocus
            className={inputCls}
            placeholder={kind === "importers" ? "ইংরেজিতে নাম, যেমন Rahman Steel" : "যেমন Evergreen Shipping"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (name.trim()) add();
              }
            }}
          />
          <Button type="button" variant="primary" loading={busy} disabled={!name.trim()} onClick={add}>
            যোগ
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
            বাতিল
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select id={id} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">— বাছাই করুন —</option>
            {list
              ?.filter((x) => x.active || String(x.id) === value)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
          <Button type="button" variant="secondary" onClick={() => setAdding(true)} title={`নতুন ${label}`} aria-label={`নতুন ${label}`}>
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </Field>
  );
}

export function JobForm({ job, onSaved }: { job?: Job; onSaved?: (j: Job) => void }) {
  const router = useRouter();
  const toast = useToast();
  const settings = useApi<Settings>("/settings");
  const importers = useApi<Importer[]>("/importers");
  const agents = useApi<Agent[]>("/agents");
  const [f, setF] = useState<FormState>(() => fromJob(job, 10000));
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New job: use the configured default rate once settings arrive.
  useEffect(() => {
    if (!job && settings.data) setF((s) => ({ ...s, ratePerContainer: String(settings.data!.defaultRate) }));
  }, [job, settings.data]);

  const errors = useMemo(() => (touched ? validate(f) : {}), [f, touched]);
  const set = <K extends keyof FormState>(k: K) => (v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const security = (Number(f.containerCount) || 0) * (Number(f.ratePerContainer) || 0);
  const balance = f.agentBillAt && f.actualCost !== "" ? security - Number(f.actualCost) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(validate(f)).length) return;
    setBusy(true);
    setServerError(null);
    const body = {
      jobNo: f.jobNo.trim(),
      cNumber: f.cNumber.trim() || null,
      importerId: Number(f.importerId),
      agentId: Number(f.agentId),
      containerCount: Number(f.containerCount),
      containerSize: f.containerSize,
      ratePerContainer: Number(f.ratePerContainer),
      depotReceivedAt: f.depotReceivedAt || null,
      surveyReceivedAt: f.surveyReceivedAt || null,
      submittedToAgentAt: f.submittedToAgentAt || null,
      agentBillAt: f.agentBillAt || null,
      actualCost: f.actualCost === "" ? null : Number(f.actualCost),
      releasedAt: f.releasedAt || null,
      note: f.note.trim() || null,
    };
    try {
      const saved = job
        ? await api<Job>(`/jobs/${job.id}`, { method: "PATCH", json: body })
        : await api<Job>("/jobs", { json: body });
      toast(job ? "জব আপডেট হয়েছে" : `জব ${saved.jobNo} সেভ হয়েছে`);
      if (onSaved) onSaved(saved);
      else router.push(`/jobs/${saved.id}`);
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const date = (k: (typeof DATES)[number][0], label: string, hint?: string) => (
    <Field label={label} htmlFor={k} hint={hint} error={errors[k]}>
      <input id={k} type="date" className={inputCls} value={f[k]} onChange={(e) => set(k)(e.target.value)} />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-3 text-[13px] font-bold tracking-wide text-accent">ধাপ ১ · জব, ইম্পোর্টার ও এজেন্ট</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="জব নম্বর" htmlFor="jobNo" error={errors.jobNo}>
            <input id="jobNo" className={inputCls} placeholder="যেমন JOB-2413" value={f.jobNo} onChange={(e) => set("jobNo")(e.target.value)} />
          </Field>
          <Field label="C নম্বর" htmlFor="cNumber" hint="শুধু সংখ্যা, যেমন 254777" error={errors.cNumber}>
            <input id="cNumber" inputMode="numeric" className={inputCls} value={f.cNumber} onChange={(e) => set("cNumber")(e.target.value)} />
          </Field>
          <NamedSelect
            id="importerId"
            label="ইম্পোর্টার"
            kind="importers"
            value={f.importerId}
            onChange={set("importerId")}
            list={importers.data}
            error={errors.importerId}
            onCreated={importers.reload}
          />
          <NamedSelect
            id="agentId"
            label="শিপিং এজেন্ট"
            kind="agents"
            value={f.agentId}
            onChange={set("agentId")}
            list={agents.data}
            error={errors.agentId}
            onCreated={agents.reload}
          />
          <Field label="কন্টেইনার সংখ্যা" htmlFor="containerCount" error={errors.containerCount}>
            <input id="containerCount" type="number" min={1} className={inputCls} value={f.containerCount} onChange={(e) => set("containerCount")(e.target.value)} />
          </Field>
          <Field label="কন্টেইনার সাইজ" htmlFor="containerSize">
            <select id="containerSize" className={inputCls} value={f.containerSize} onChange={(e) => set("containerSize")(e.target.value as "20" | "40")}>
              <option value="20">২০ ফুট</option>
              <option value="40">৪০ ফুট</option>
            </select>
          </Field>
          <Field label="প্রতি কন্টেইনার সিকিউরিটি (টাকা)" htmlFor="ratePerContainer" hint="ডিফল্ট সেটিংস থেকে আসে, দরকারে বদলান" error={errors.ratePerContainer}>
            <input id="ratePerContainer" type="number" min={0} step={500} className={inputCls} value={f.ratePerContainer} onChange={(e) => set("ratePerContainer")(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-[13px] font-bold tracking-wide text-accent">ধাপ ২ · ডিপো ও সার্ভে</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {date("depotReceivedAt", "ডিপো রিসিভিং তারিখ")}
          {date("surveyReceivedAt", "সার্ভে রিপোর্ট পাওয়ার তারিখ", "রিপোর্ট হাতে এলে দিন")}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-[13px] font-bold tracking-wide text-accent">ধাপ ৩ · শিপিং এজেন্টের হিসাব ও রিলিজ</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {date("submittedToAgentAt", "এজেন্টকে জমার তারিখ")}
          {date("agentBillAt", "এজেন্টের হিসাবের তারিখ")}
          <Field label="আসল খরচ (এজেন্টের হিসাব, টাকা)" htmlFor="actualCost" hint="হিসাব এলে লিখুন" error={errors.actualCost}>
            <input id="actualCost" type="number" min={0} className={inputCls} value={f.actualCost} onChange={(e) => set("actualCost")(e.target.value)} />
          </Field>
          {date("releasedAt", "রিলিজ / ফাইনাল সেটেলমেন্ট তারিখ")}
          <Field label="নোট (ঐচ্ছিক)" htmlFor="note" className="sm:col-span-2">
            <input id="note" className={inputCls} value={f.note} onChange={(e) => set("note")(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 rounded-lg bg-sunk px-4 py-3" aria-live="polite">
          <span>
            সিকিউরিটি মানি: <b className="num">{tk(security)}</b>
          </span>
          <span>
            ব্যালেন্স:{" "}
            {balance === null ? (
              <b className="text-crit">Pending · হিসাব আসেনি</b>
            ) : (
              <b className={`num ${balance > 0 ? "text-good" : balance < 0 ? "text-warn" : ""}`}>
                {signed(balance)} {balance > 0 ? "(ফেরত পাবো)" : balance < 0 ? "(বাড়তি খরচ)" : ""}
              </b>
            )}
          </span>
        </div>
      </Card>

      {serverError && (
        <p className="rounded-lg bg-crit-bg px-4 py-3 font-semibold text-crit" role="alert">
          {serverError}
        </p>
      )}
      {touched && Object.keys(errors).length > 0 && (
        <p className="font-semibold text-crit" role="alert">লাল লেখা ঘরগুলো ঠিক করে আবার সেভ করুন।</p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          বাতিল
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {job ? "আপডেট সেভ করুন" : "জব সেভ করুন"}
        </Button>
      </div>
    </form>
  );
}
