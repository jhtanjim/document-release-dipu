"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { api, useApi } from "@/lib/api";
import type { Agent, Importer, Job, Settings } from "@/lib/types";
import { signed, tk } from "@/lib/format";
import { useLang, type Lang } from "@/lib/i18n";
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
  ["depotReceivedAt", { bn: "ডিপো রিসিভিং", en: "Depot receiving" }],
  ["surveyReceivedAt", { bn: "সার্ভে রিপোর্ট", en: "Survey report" }],
  ["submittedToAgentAt", { bn: "এজেন্টে জমা", en: "Submitted to agent" }],
  ["agentBillAt", { bn: "এজেন্টের হিসাব", en: "Agent's bill" }],
  ["releasedAt", { bn: "রিলিজ", en: "Release" }],
] as const;

function fromJob(j: Job | undefined, defaultRate: number): FormState {
  return {
    jobNo: j?.jobNo ?? "",
    cNumber: j?.cNumber ?? "",
    importerId: j ? String(j.importer.id) : "",
    agentId: j ? String(j.agent.id) : "",
    containerCount: j ? String(j.containerCount) : "1",
    containerSize: j?.containerSize ?? "20",
    ratePerContainer: String(j?.ratePerContainer ?? defaultRate),
    depotReceivedAt: j?.depotReceivedAt ?? "",
    surveyReceivedAt: j?.surveyReceivedAt ?? "",
    submittedToAgentAt: j?.submittedToAgentAt ?? "",
    agentBillAt: j?.agentBillAt ?? "",
    actualCost: j?.actualCost != null ? String(j.actualCost) : "",
    releasedAt: j?.releasedAt ?? "",
    note: j?.note ?? "",
  };
}

function validate(f: FormState, lang: Lang): Partial<Record<keyof FormState, string>> {
  const t = (bn: string, en: string) => (lang === "en" ? en : bn);
  const e: Partial<Record<keyof FormState, string>> = {};
  if (!f.jobNo.trim()) e.jobNo = t("জব নম্বর দিন।", "Enter the job number.");
  if (f.cNumber && !/^\d+$/.test(f.cNumber.trim())) e.cNumber = t("শুধু সংখ্যা দিন, যেমন 254777।", "Digits only, e.g. 254777.");
  if (!f.importerId) e.importerId = t("ইম্পোর্টার বাছাই করুন।", "Choose an importer.");
  if (!f.agentId) e.agentId = t("শিপিং এজেন্ট বাছাই করুন।", "Choose a shipping agent.");
  if (!(Number(f.containerCount) >= 1) || !Number.isInteger(Number(f.containerCount)))
    e.containerCount = t("কমপক্ষে ১টা কন্টেইনার।", "At least 1 container.");
  if (f.ratePerContainer === "" || !(Number(f.ratePerContainer) >= 0)) e.ratePerContainer = t("রেট টাকায় লিখুন।", "Enter the rate in taka.");
  if (f.agentBillAt && f.actualCost === "") e.actualCost = t("হিসাবের তারিখ দিলে আসল খরচও লিখুন।", "With a bill date, also enter the actual cost.");
  if (f.actualCost !== "" && !f.agentBillAt) e.agentBillAt = t("আসল খরচ লিখলে হিসাবের তারিখও দিন।", "With an actual cost, also enter the bill date.");
  let prev: (typeof DATES)[number] | null = null;
  for (const d of DATES) {
    if (f[d[0]]) {
      if (prev && f[d[0]] < f[prev[0]])
        e[d[0]] = t(`${d[1].bn}-এর তারিখ ${prev[1].bn}-এর আগে হতে পারে না।`, `${d[1].en} date can't be before ${prev[1].en}.`);
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
  const { t } = useLang();

  async function add() {
    setBusy(true);
    setErr(null);
    try {
      const created = await api<Importer>(`/${kind}`, { json: { name: name.trim() } });
      onCreated();
      onChange(String(created.id));
      toast(t(`${created.name} যোগ হয়েছে`, `${created.name} added`));
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
            placeholder={kind === "importers" ? t("ইংরেজিতে নাম, যেমন Rahman Steel", "Name in English, e.g. Rahman Steel") : t("যেমন Evergreen Shipping", "e.g. Evergreen Shipping")}
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
            {t("যোগ", "Add")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
            {t("বাতিল", "Cancel")}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select id={id} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">{t("— বাছাই করুন —", "— Choose —")}</option>
            {list
              ?.filter((x) => x.active || String(x.id) === value)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
          <Button type="button" variant="secondary" onClick={() => setAdding(true)} title={t(`নতুন ${label}`, `New ${label}`)} aria-label={t(`নতুন ${label}`, `New ${label}`)}>
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
  const { lang, t } = useLang();
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

  const errors = useMemo(() => (touched ? validate(f, lang) : {}), [f, touched, lang]);
  const set = <K extends keyof FormState>(k: K) => (v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const security = (Number(f.containerCount) || 0) * (Number(f.ratePerContainer) || 0);
  const balance = f.agentBillAt && f.actualCost !== "" ? security - Number(f.actualCost) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(validate(f, lang)).length) return;
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
      toast(job ? t("জব আপডেট হয়েছে", "Job updated") : t(`জব ${saved.jobNo} সেভ হয়েছে`, `Job ${saved.jobNo} saved`));
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

  const stepTitle = "mb-3 flex items-center gap-2 text-[14px] font-bold text-accent";
  const stepNo = "num grid size-6 place-items-center rounded-full bg-accent text-[12px] text-accent-ink";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Card>
        <h2 className={stepTitle}>
          <span className={stepNo}>1</span>
          {t("জব, ইম্পোর্টার ও এজেন্ট", "Job, importer and agent")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("জব নম্বর", "Job number")} htmlFor="jobNo" error={errors.jobNo}>
            <input id="jobNo" className={inputCls} placeholder={t("যেমন JOB-2413", "e.g. JOB-2413")} value={f.jobNo} onChange={(e) => set("jobNo")(e.target.value)} />
          </Field>
          <Field label={t("C নম্বর", "C number")} htmlFor="cNumber" hint={t("শুধু সংখ্যা, যেমন 254777", "Digits only, e.g. 254777")} error={errors.cNumber}>
            <input id="cNumber" inputMode="numeric" className={inputCls} value={f.cNumber} onChange={(e) => set("cNumber")(e.target.value)} />
          </Field>
          <NamedSelect
            id="importerId"
            label={t("ইম্পোর্টার", "Importer")}
            kind="importers"
            value={f.importerId}
            onChange={set("importerId")}
            list={importers.data}
            error={errors.importerId}
            onCreated={importers.reload}
          />
          <NamedSelect
            id="agentId"
            label={t("শিপিং এজেন্ট", "Shipping agent")}
            kind="agents"
            value={f.agentId}
            onChange={set("agentId")}
            list={agents.data}
            error={errors.agentId}
            onCreated={agents.reload}
          />
          <Field label={t("কন্টেইনার সংখ্যা", "Number of containers")} htmlFor="containerCount" error={errors.containerCount}>
            <input id="containerCount" type="number" min={1} className={inputCls} value={f.containerCount} onChange={(e) => set("containerCount")(e.target.value)} />
          </Field>
          <Field label={t("কন্টেইনার সাইজ", "Container size")} htmlFor="containerSize">
            <select id="containerSize" className={inputCls} value={f.containerSize} onChange={(e) => set("containerSize")(e.target.value as "20" | "40")}>
              <option value="20">{t("২০ ফুট", "20 ft")}</option>
              <option value="40">{t("৪০ ফুট", "40 ft")}</option>
            </select>
          </Field>
          <Field
            label={t("প্রতি কন্টেইনার সিকিউরিটি (টাকা)", "Security per container (taka)")}
            htmlFor="ratePerContainer"
            hint={t("ডিফল্ট সেটিংস থেকে আসে, দরকারে বদলান", "Comes from settings; change it if needed")}
            error={errors.ratePerContainer}
          >
            <input id="ratePerContainer" type="number" min={0} step={500} className={inputCls} value={f.ratePerContainer} onChange={(e) => set("ratePerContainer")(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className={stepTitle}>
          <span className={stepNo}>2</span>
          {t("ডিপো ও সার্ভে", "Depot and survey")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {date("depotReceivedAt", t("ডিপো রিসিভিং তারিখ", "Depot receiving date"), t("ডিপো রিসিভিং ফাইল না এলে খালি রাখুন, পরে বসাবেন", "Leave empty until the depot receiving file arrives"))}
          {date(
            "surveyReceivedAt",
            t("সার্ভে রিপোর্ট পাওয়ার তারিখ", "Survey report date"),
            t("রিপোর্ট না এলে খালি রাখুন; খালি থাকলে স্টেটমেন্টে উঠবে না", "Leave empty until it arrives; the job stays off the statement until then"),
          )}
        </div>
      </Card>

      <Card>
        <h2 className={stepTitle}>
          <span className={stepNo}>3</span>
          {t("শিপিং এজেন্টের হিসাব ও রিলিজ", "Agent's bill and release")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {date("submittedToAgentAt", t("এজেন্টকে জমার তারিখ", "Submitted to agent"))}
          {date("agentBillAt", t("এজেন্টের হিসাবের তারিখ", "Agent's bill date"))}
          <Field label={t("আসল খরচ (এজেন্টের হিসাব, টাকা)", "Actual cost (agent's bill, taka)")} htmlFor="actualCost" hint={t("হিসাব এলে লিখুন", "Enter it when the bill arrives")} error={errors.actualCost}>
            <input id="actualCost" type="number" min={0} className={inputCls} value={f.actualCost} onChange={(e) => set("actualCost")(e.target.value)} />
          </Field>
          {date("releasedAt", t("রিলিজ / ফাইনাল সেটেলমেন্ট তারিখ", "Release / final settlement date"))}
          <Field label={t("নোট (ঐচ্ছিক)", "Note (optional)")} htmlFor="note" className="sm:col-span-2">
            <input id="note" className={inputCls} value={f.note} onChange={(e) => set("note")(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 rounded-md bg-sunk px-4 py-3" aria-live="polite">
          <span>
            {t("সিকিউরিটি মানি", "Security money")}: <b className="num">{tk(security)}</b>
          </span>
          <span>
            {t("ব্যালেন্স", "Balance")}:{" "}
            {balance === null ? (
              <b className="text-crit">{t("Pending · হিসাব আসেনি", "Pending · no bill yet")}</b>
            ) : (
              <b className={`num ${balance > 0 ? "text-good" : balance < 0 ? "text-warn" : ""}`}>
                {signed(balance)} {balance > 0 ? t("(ফেরত পাবো)", "(refund due)") : balance < 0 ? t("(বাড়তি খরচ)", "(extra cost)") : ""}
              </b>
            )}
          </span>
        </div>
      </Card>

      {serverError && (
        <p className="rounded-md bg-crit-bg px-4 py-3 font-semibold text-crit" role="alert">
          {serverError}
        </p>
      )}
      {touched && Object.keys(errors).length > 0 && (
        <p className="font-semibold text-crit" role="alert">
          {t("লাল লেখা ঘরগুলো ঠিক করে আবার সেভ করুন।", "Fix the fields marked in red, then save again.")}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          {t("বাতিল", "Cancel")}
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          {job ? t("আপডেট সেভ করুন", "Save changes") : t("জব সেভ করুন", "Save job")}
        </Button>
      </div>
    </form>
  );
}
